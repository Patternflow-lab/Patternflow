// Production allocation and lifecycle code; hardware replaced at its boundary.
#include <atomic>
#include <cassert>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <map>
#include <utility>
#include <thread>
#include <mutex>
#include <condition_variable>
#include <chrono>
#ifdef _MSC_VER
#define __ATOMIC_ACQUIRE 0
#define __ATOMIC_RELEASE 0
#define __ATOMIC_ACQ_REL 0
template<class T> T __atomic_load_n(T* p, int) { return std::atomic_ref<T>(*p).load(); }
template<class T, class V> void __atomic_store_n(T* p, V v, int) {
  std::atomic_ref<T>(*p).store(static_cast<T>(v));
}
template<class T, class V> T __atomic_exchange_n(T* p, V v, int) {
  return std::atomic_ref<T>(*p).exchange(static_cast<T>(v));
}
#endif
constexpr unsigned MALLOC_CAP_INTERNAL=1, MALLOC_CAP_8BIT=2, MALLOC_CAP_SPIRAM=4;
constexpr unsigned MALLOC_CAP_EXEC=8, MALLOC_CAP_32BIT=16;
static size_t internalFree=100000, largest=100000;
static bool externalFails=false;
static std::map<void*,size_t> internalOwned;
static size_t heap_caps_get_free_size(unsigned) { return internalFree; }
static size_t externalLargest=1u<<20;
static size_t heap_caps_get_largest_free_block(unsigned caps) {
  if (caps & MALLOC_CAP_SPIRAM) return externalFails ? 0 : externalLargest;
  return largest;
}
static size_t externalAsked=0;
static void* heap_caps_malloc(size_t n, unsigned caps) {
  if (caps & MALLOC_CAP_SPIRAM) { externalAsked=n; return externalFails ? nullptr : malloc(n); }
  if (n>internalFree || n>largest) return nullptr;
  void* p=malloc(n); assert(p); internalOwned[p]=n; internalFree-=n;
  return p;
}
static void* heap_caps_calloc(size_t n,size_t s,unsigned caps) {
  void* p=heap_caps_malloc(n*s,caps); if(p) memset(p,0,n*s); return p;
}
static void heap_caps_free(void* p) {
  auto i=internalOwned.find(p);
  if(i!=internalOwned.end()) { internalFree+=i->second; internalOwned.erase(i); }
  free(p);
}
#include "core_module_memory.h"
#include "sidecar_name.h"

using TaskHandle_t = void*;
static thread_local TaskHandle_t task=reinterpret_cast<void*>(1);
static TaskHandle_t xTaskGetCurrentTaskHandle() { return task; }
static uint32_t micros() {
  return static_cast<uint32_t>(std::chrono::duration_cast<std::chrono::microseconds>(
      std::chrono::steady_clock::now().time_since_epoch()).count());
}
// A stalled loop is told by the clock, and nobody waits ten real seconds for
// one: real time supplies the 25 ms slices, leapMs the stall. Taken from the
// 64-bit count rather than micros()/1000, which steps back to zero every 71
// minutes - a step the loop's age would read as 49 days without a beat.
static std::atomic<uint32_t> leapMs{0};
static uint32_t millis() {
  return static_cast<uint32_t>(std::chrono::duration_cast<std::chrono::milliseconds>(
      std::chrono::steady_clock::now().time_since_epoch()).count())+leapMs;
}
constexpr unsigned portMAX_DELAY=0xffffffffu, pdTRUE=1, pdPASS=1;
#define pdMS_TO_TICKS(x) (x)
// One tick. Shortened where a case wants its caller to look thousands of times.
static std::atomic<unsigned> tickUs{1000};
struct Semaphore { std::mutex m; std::condition_variable cv; bool ready=false; };
using SemaphoreHandle_t=Semaphore*;
static Semaphore* xSemaphoreCreateBinary() { return new Semaphore; }
static Semaphore* xSemaphoreCreateMutex() { auto p=new Semaphore; p->ready=true; return p; }
static unsigned xSemaphoreTake(Semaphore* s,unsigned ms) {
  std::unique_lock<std::mutex> lock(s->m);
  if(ms==portMAX_DELAY) s->cv.wait(lock,[&]{return s->ready;});
  else if(!s->cv.wait_for(lock,std::chrono::microseconds(uint64_t(ms)*tickUs),[&]{return s->ready;})) return 0;
  s->ready=false; return pdTRUE;
}
static void xSemaphoreGive(Semaphore* s) {
  std::lock_guard<std::mutex> lock(s->m); s->ready=true; s->cv.notify_one();
}
struct Logger { void println(const char*) {} template<class... T> void printf(const char*,T...) {} } Serial;
namespace PFRuntime { inline void noteSync(uint32_t) {} }
#include "core_loop_sync.h"
// A thread standing in for the network task. Its maintenance hook runs once a
// slice, just before the caller decides whether to give up on the loop - the
// one moment these cases need to meet - and `looks` counts them. With
// `rendezvous` set the caller is held at that point until the loop says go,
// and for `callerLag` spins more, so the two can be let at the request in the
// same instant whichever of them is the quicker off the mark.
static std::atomic<unsigned> looks{0};
static std::atomic<bool> rendezvous{false}, atDoor{false}, go{false};
static std::atomic<int> callerLag{0};
// A few nanoseconds a spin, in work the optimiser has to leave in: a loop of
// loads whose value nobody used compiled to nothing, and the aim never moved.
static void spin(int spins) {
  static thread_local std::atomic<unsigned> turns{0};
  for(; spins>0; --spins) ++turns;
}
static void becomeCaller() {
  task=reinterpret_cast<void*>(2);
  PFNetMaintenance::attach([]{
    ++looks;
    if(!rendezvous) return;
    atDoor=true;
    while(!go) {}
    spin(callerLag);
    atDoor=false;
  });
}
static bool callerLooked(unsigned times) {
  const unsigned from=looks;
  const auto limit=std::chrono::steady_clock::now()+std::chrono::seconds(10);
  while(looks-from<times) {
    if(std::chrono::steady_clock::now()>limit) return false;
    std::this_thread::yield();
  }
  return true;
}
static bool posted() { return __atomic_load_n(&PFLoopSync::pendingFn,__ATOMIC_ACQUIRE)!=nullptr; }

constexpr int MODULE_PATH_BYTES=96, MODULE_NAME_BYTES=64, NUM_PRESETS=1, PF_CUSTOM_SLOT_COUNT=0;
struct PatternEntry { const char* name; const char* modulePath; };
static PatternEntry entries[]={{"Origin",nullptr},{"A","/a.pfm"},{"B","/b.pfm"}};
static PatternEntry* patterns=entries;
static int NUM_PATTERNS=3, activePatternIdx=1, currentPatternIdx=1, numModules=2;
static char moduleNames[2][MODULE_NAME_BYTES]{};
static int FFat=0;
static bool createFails=false, notified=false, reorder=false, removeB=false;
static unsigned created=0;
static unsigned retryPauseMs=0;
static void vTaskDelay(unsigned ms) { retryPauseMs+=ms; }
namespace PFModuleLoader {
struct Descriptor { const char* name; } descriptor{"loaded"};
inline Descriptor* active=&descriptor;
inline unsigned unloads=0, loads=0;
inline unsigned allocationFailures=0;
inline bool invalidFile=false;
inline void unload() { ++unloads; active=nullptr; }
inline bool load(int,const char*) {
  ++loads;
  if(invalidFile) return false;
  if(allocationFailures) { --allocationFailures; ++PFModuleMemory::refusals; return false; }
  active=&descriptor; return true;
}
inline bool fail(const char*) { return false; }
inline const char* error() { return "test"; }
}
static int xTaskCreatePinnedToCore(void(*)(void*),const char*,uint32_t,void*,unsigned,void** out,int) {
  if(createFails) return 0;
  ++created; *out=reinterpret_cast<void*>(3); return pdPASS;
}
static void xTaskNotifyGive(void*) { notified=true; }
static void ulTaskNotifyTake(unsigned,unsigned) { assert(notified); }
static uint32_t uxTaskGetStackHighWaterMark(void*) { return 4096; }
#include "registry_lifecycle.h"
static void buildPatternList() {
  if(reorder) { std::swap(entries[1],entries[2]); reorder=false; }
  if(removeB) { entries[1]={"A","/a.pfm"}; NUM_PATTERNS=2; }
}
namespace Manager {
#include "patterns_lifecycle.h"
}
int main() {
  assert(!PFModuleMemory::fits(SIZE_MAX,100,50));
  assert(!PFModuleMemory::fits(1,100,101));
  externalFails=true; internalFree=PF_MODULE_INTERNAL_RESERVE+99;
  assert(!PFModuleMemory::data(100,true,true)); // PSRAM failure cannot bypass reserve
  internalFree=100000; largest=50;
  void* held=nullptr;
  assert(!PFModuleMemory::code(100,&held) && !held); // fragmentation despite ample total heap
  // Admission is on the SUM of the module's executable sections, and refuses
  // without allocating anything - no allocate-then-roll-back.
  largest=100000; externalFails=false;
  internalFree=PF_MODULE_INTERNAL_RESERVE+4000;
  assert(!PFModuleMemory::admitCode(2500+2500) && PFModuleMemory::dataBudget==0);
  assert(internalFree==PF_MODULE_INTERNAL_RESERVE+4000 && internalOwned.empty());
  assert(PFModuleMemory::admitCode(2500) && PFModuleMemory::dataBudget==1500);
  // Data past the budget moves to PSRAM and leaves code's share alone; data
  // within it is placed internally and charged. Neither can fail the load.
  void* wide=PFModuleMemory::data(3000,true,false);
  assert(wide && PFModuleMemory::dataBudget==1500);
  assert(internalFree==PF_MODULE_INTERNAL_RESERVE+4000);
  heap_caps_free(wide);
  void* narrow=PFModuleMemory::data(1000,true,false);
  assert(narrow && PFModuleMemory::dataBudget==500);
  assert(internalFree==PF_MODULE_INTERNAL_RESERVE+3000);
  heap_caps_free(narrow);
  // PSRAM gone: the reserve still binds the internal fallback.
  externalFails=true; PFModuleMemory::endLoad();
  assert(!PFModuleMemory::data(100000,true,true));
  externalFails=false; internalFree=100;
  void* p=PFModuleMemory::data(128,true,false); assert(p);
  for(int i=0;i<128;++i) assert(static_cast<unsigned char*>(p)[i]==0);
  heap_caps_free(p);

  // Code has a second home. With the fallback policy, what fits internally
  // still goes there and is charged; what does not fit moves to PSRAM, is
  // charged nothing, and leaves the whole budget to the module's data.
  internalFree=PF_MODULE_INTERNAL_RESERVE+4000; largest=100000;
  PFModuleMemory::codePolicy=PF_MODULE_CODE_PSRAM_FALLBACK;
  assert(PFModuleMemory::admitCode(2500) && !PFModuleMemory::codeExternal);
  assert(PFModuleMemory::dataBudget==1500);
  assert(PFModuleMemory::admitCode(5000) && PFModuleMemory::codeExternal);
  assert(PFModuleMemory::dataBudget==4000);
  void* far=PFModuleMemory::code(5000,&held);
  assert(far && internalOwned.empty() && internalFree==PF_MODULE_INTERNAL_RESERVE+4000);
  // ...in a block that owns whole cache lines, so the write-back never
  // touches a line the allocator or a neighbour is using.
  // One line of slack, the code on a line boundary inside the allocation:
  // every line it occupies is the allocation's own.
  assert(externalAsked==5056+64 && reinterpret_cast<uintptr_t>(far)%64==0);
  assert(static_cast<char*>(far)>=static_cast<char*>(held) &&
         static_cast<char*>(far)+5056<=static_cast<char*>(held)+externalAsked);
  heap_caps_free(held);
  // Room in total is not a block: code refused for fragmentation is exactly
  // what the second home is for.
  largest=2000;
  assert(PFModuleMemory::admitCode(2500) && PFModuleMemory::codeExternal);
  largest=100000;
  // Services under the reserve: budget is zero and code still has somewhere.
  internalFree=PF_MODULE_INTERNAL_RESERVE-1;
  assert(PFModuleMemory::admitCode(1) && PFModuleMemory::codeExternal);
  assert(PFModuleMemory::dataBudget==0);
  // PSRAM-first: code never takes internal RAM while PSRAM can hold it.
  internalFree=PF_MODULE_INTERNAL_RESERVE+4000;
  PFModuleMemory::codePolicy=PF_MODULE_CODE_PSRAM_FIRST;
  assert(PFModuleMemory::admitCode(2500) && PFModuleMemory::codeExternal);
  assert(PFModuleMemory::dataBudget==4000);
  // No PSRAM, or no block that large: both policies fall back to the internal
  // rule exactly - same verdict, same budget, nothing allocated to find out.
  externalLargest=2000;
  assert(PFModuleMemory::admitCode(2500) && !PFModuleMemory::codeExternal);
  assert(PFModuleMemory::dataBudget==1500);
  externalFails=true; externalLargest=1u<<20;
  assert(!PFModuleMemory::admitCode(5000) && !PFModuleMemory::codeExternal);
  assert(PFModuleMemory::dataBudget==0 && internalOwned.empty());
  PFModuleMemory::codePolicy=PF_MODULE_CODE_PSRAM_FALLBACK;
  assert(!PFModuleMemory::admitCode(5000) && !PFModuleMemory::codeExternal);
  // The old rule is still there to be chosen.
  externalFails=false;
  PFModuleMemory::codePolicy=PF_MODULE_CODE_INTERNAL;
  assert(!PFModuleMemory::admitCode(5000) && !PFModuleMemory::codeExternal);
  // ...and is what a unit falls back to once a PSRAM placement has failed to
  // verify: the same pick then lands internally instead of failing again.
  PFModuleMemory::codePolicy=PF_MODULE_CODE_PSRAM_FIRST;
  PFModuleMemory::codeDemoted=true;
  assert(PFModuleMemory::codeRule()==PF_MODULE_CODE_INTERNAL);
  assert(PFModuleMemory::admitCode(2500) && !PFModuleMemory::codeExternal);
  assert(!PFModuleMemory::admitCode(5000));
  PFModuleMemory::codeDemoted=false;
  PFModuleMemory::codePolicy=PF_MODULE_CODE_POLICY; PFModuleMemory::endLoad();
  internalFree=100;

  // A sidecar's name, as the build writes it and as a person might.
  {
    char name[64];
    assert(jsonStringValue("Wave Saw\", \"abi\": 2}", name, sizeof(name)) && !strcmp(name,"Wave Saw"));
    // An escaped quote is part of the name, not the end of it.
    assert(jsonStringValue("Say \\\"hi\\\" \\\\ there\"", name, sizeof(name)));
    assert(!strcmp(name,"Say \"hi\" \\ there"));
    // The build spells non-ASCII as \uXXXX; the stored name is UTF-8.
    assert(jsonStringValue("Dynamic Moir\\u00e9\"", name, sizeof(name)));
    assert(!strcmp(name,"Dynamic Moir\xC3\xA9"));
    assert(jsonStringValue("\\ud328\\ud134\"", name, sizeof(name)) && !strcmp(name,"\xED\x8C\xA8\xED\x84\xB4"));
    assert(jsonStringValue("\\ud83c\\udf0a\"", name, sizeof(name)) && !strcmp(name,"\xF0\x9F\x8C\x8A"));
    // A character that does not fit is left out whole, and nothing after it.
    char tight[6];
    assert(jsonStringValue("abcd\\u00e9z\"", tight, sizeof(tight)) && !strcmp(tight,"abcd"));
    assert(jsonStringValue("ab\xED\x8C\xA8z\"", tight, sizeof(tight)) && !strcmp(tight,"ab\xED\x8C\xA8"));
    // Control escapes vanish; what never closes, or holds nothing, is no name.
    assert(jsonStringValue("a\\nb\\tc\"", name, sizeof(name)) && !strcmp(name,"abc"));
    assert(!jsonStringValue("never closed", name, sizeof(name)));
    assert(!jsonStringValue("ends in a backslash\\", name, sizeof(name)));
    assert(!jsonStringValue("bad \\u12 escape\"", name, sizeof(name)));
    assert(!jsonStringValue("\"", name, sizeof(name)));
    assert(!jsonStringValue("\\n\\t\"", name, sizeof(name)));
  }

  PFLoopSync::attach();
  int attempts=0, commits=0;
  assert(!PFLoopSync::runWhen([&]{ ++attempts; return false; }));
  std::atomic<bool> finished=false;
  std::thread caller([&]{
    task=reinterpret_cast<void*>(2);
    assert(PFLoopSync::runWhen([&]{ if(++attempts<5) return false; ++commits; return true; }));
    finished=true;
  });
  unsigned frames=0;
  while(!finished) { PFLoopSync::service(); ++frames; std::this_thread::yield(); }
  caller.join(); assert(commits==1 && frames>=4);

  // The loop stops. Nothing services, the stamp turns PF_LOOP_STALL_MS old,
  // and the caller takes its request back and is told it did not run. What it
  // took back must never run - not when the loop wakes, not ever: the lambda
  // it pointed at went with the caller's stack frame.
  {
    int ran=0; bool answered=true;
    std::thread stuck([&]{ becomeCaller(); answered=PFLoopSync::run([&]{ ++ran; }); });
    while(!posted()) std::this_thread::yield();
    assert(!PFLoopSync::stalled() && PFLoopSync::gaveUp==0);
    leapMs+=PF_LOOP_STALL_MS;
    stuck.join();
    assert(!answered && ran==0 && PFLoopSync::gaveUp==1 && PFLoopSync::stalled());
    PFLoopSync::service();
    assert(ran==0 && !PFLoopSync::stalled());
  }
  // How long a caller has waited is not evidence. A transaction the loop
  // keeps testing outlasts the limit - a module's setup() is seconds - for as
  // long as the loop keeps arriving. When the loop then stops, it is taken
  // back like any other, and the attempt is not tried again.
  {
    int tries=0; bool committed=true;
    std::thread waiting([&]{ becomeCaller(); committed=PFLoopSync::runWhen([&]{ ++tries; return false; }); });
    while(!posted()) std::this_thread::yield();
    for(int frame=1; frame<=3; ++frame) {
      PFLoopSync::service();
      leapMs+=PF_LOOP_STALL_MS/2;
      assert(callerLooked(2) && posted() && tries==frame);
    }
    leapMs+=PF_LOOP_STALL_MS;
    waiting.join();
    assert(!committed && tries==3 && PFLoopSync::gaveUp==2);
    PFLoopSync::service();
    assert(tries==3);
  }
  // A call the loop has taken is waited out, however dead the loop looks from
  // outside while it is in there: the body is running on the caller's stack
  // frame. And the loop stamps on its way out, or the next request would find
  // a stalled loop one frame before it answered.
  {
    int ran=0; std::atomic<bool> returned=false;
    std::thread held([&]{
      becomeCaller();
      const bool ok=PFLoopSync::run([&]{
        leapMs+=2*PF_LOOP_STALL_MS;
        assert(callerLooked(2) && !returned);
        ++ran;
      });
      assert(ok); returned=true;
    });
    while(!ran) PFLoopSync::service();
    assert(!PFLoopSync::stalled());
    held.join(); assert(ran==1 && PFLoopSync::gaveUp==2);
  }
  // The age is never read from the future: with the loop stamping flat out,
  // a reader that took the clock before the stamp would see 49 days. Only a
  // millisecond turning over between its two reads can show that, so this
  // runs across three hundred of them.
  {
    std::atomic<bool> read=false;
    std::thread reader([&]{
      const auto until=std::chrono::steady_clock::now()+std::chrono::milliseconds(300);
      while(std::chrono::steady_clock::now()<until) {
        for(int i=0; i<1000; ++i) assert(PFLoopSync::loopAgeMs()<PF_LOOP_STALL_MS);
      }
      read=true;
    });
    while(!read) PFLoopSync::service();
    reader.join();
  }
  // The race itself: the caller reaching to take its request back at the
  // moment the loop reaches to take it. One exchange lands first. Either the
  // body runs once and its caller hears that it ran, or it never runs and its
  // caller hears that. Each call's record stands in for the caller's stack
  // frame and outlives it, so a body that runs after its caller has left
  // finds `live` false instead of whatever the next call put at that address.
  //
  // Whether this meets the race or only walks round it was settled by
  // breaking the code under it: with the caller taking its request back by a
  // load and a store, or the loop taking it by a load, the "told the truth"
  // assert went off on every run (g++ -O2, with and without the sanitizers,
  // on two cores and on twenty). A caller that leaves without looking at
  // what its exchange returned does not get this far: the call that has to
  // be waited out, two cases up, catches it.
  {
    struct Call { std::atomic<bool> live{false}; std::atomic<unsigned> ran{0}; };
    static Call calls[4000];
    tickUs=4;
    std::atomic<bool> over=false;
    unsigned completed=0; std::atomic<unsigned> withdrawn=0;
    std::thread racer([&]{
      becomeCaller();
      const auto limit=std::chrono::steady_clock::now()+std::chrono::seconds(3);
      for(Call& call : calls) {
        if(std::chrono::steady_clock::now()>limit) break;
        call.live=true;
        const bool ok=PFLoopSync::runRaw([](void* p){
          Call* mine=static_cast<Call*>(p); assert(mine->live); ++mine->ran;
        }, &call);
        call.live=false;
        // Told the truth, and nothing of this call left on the table.
        assert(call.ran==(ok?1u:0u) && !posted());
        if(ok) ++completed; else ++withdrawn;
      }
      over=true;
    });
    uint32_t dice=1; unsigned lost=0;
    int lead=0;   // spins the loop gives the caller; negative, the caller gives the loop
    int step=16; bool callerWon=false;
    rendezvous=true;
    while(!over) {
      if(!posted()) continue;
      // Go quiet for a stall's worth, hold the caller at the point of looking,
      // let both go at once. How much start one needs over the other to make
      // a tie is the machine's business, so aim: the loop a little later
      // after a call it got to first, a little sooner after one the caller
      // took back, in steps that halve each time the winner changes. The two
      // exchanges then keep meeting, which a fixed delay does only by luck.
      const bool won=withdrawn!=lost; lost=withdrawn;
      if(won!=callerWon && step>1) step/=2;
      callerWon=won;
      if(won ? lead>-100000 : lead<100000) lead+=won ? -step : step;
      dice=dice*1664525u+1013904223u;
      const int jitter=int(dice>>30);
      callerLag=lead<0 ? jitter-lead : 0;
      leapMs+=PF_LOOP_STALL_MS;
      while(!atDoor && !over) {}
      go=true;
      spin(lead>0 ? lead+jitter : 0);
      PFLoopSync::service();
      while(atDoor) {}
      go=false;
    }
    racer.join(); rendezvous=false; tickUs=1000;
    PFLoopSync::service();
    unsigned bodies=0;
    for(Call& call : calls) bodies+=call.ran;
    assert(bodies==completed && PFLoopSync::gaveUp==2+withdrawn && !posted());
    printf("loop hand-off race: %u ran, %u withdrawn\n", completed, withdrawn.load());
    // Both ways, or the two never met and everything above passed for want of
    // a race. The aim swings back each time one side wins, so with a core each
    // both must turn up - they did with a third thread spinning on the same
    // two cores. On a single core the threads take turns instead of tying
    // (the loop won 366 of 366 pinned to one), and a machine that has only
    // the one is let off; pinned to one core of many with taskset this still
    // fails, which is the honest answer for a run that raced nothing.
    if(std::thread::hardware_concurrency()>1) assert(completed && withdrawn);
  }

  createFails=true;
  assert(!activatePatternAsync(2));
  assert(activePatternIdx==1 && PFModuleLoader::active && PFModuleLoader::unloads==0);
  assert(PFModuleLoader::loads==0); // never synchronous fallback
  createFails=false;
  assert(activatePatternAsync(2)); assert(notified && loadInFlight);
  assert(!Manager::captureSelectionOnce()); // single-core fallback: busy, no eviction
  assert(!patternLoadsHeld && !Manager::restorePending);
  assert(activatePatternAsync(1)); // latest request while setup is in flight
  loadPatternJob();
  assert(Manager::captureSelectionOnce()); // finishes then holds, never starts queued loader
  assert(patternLoadsHeld && Manager::restorePending && !loadInFlight);
  auto count=created;
  assert(activatePatternAsync(1)); assert(activatePatternAsync(2));
  assert(created==count); // no loading through a storage mutation
  reorder=true;
  assert(Manager::restoreSelection());
  assert(!patternLoadsHeld && currentPatternIdx==1); // B moved from index 2 to 1
  assert(loadTargetIdx==1 && loadInFlight); // restore is asynchronous
  loadPatternJob(); serviceAsyncLoad();
  assert(Manager::captureSelectionOnce());
  assert(activatePatternAsync(1)); // B is then deleted before restore
  removeB=true; assert(Manager::restoreSelection());
  assert(currentPatternIdx==0 && activePatternIdx==0 && !loadInFlight);
  assert(created==1); // every later selection reuses the single reserved worker
  loadTargetIdx=1;
  PFModuleLoader::allocationFailures=2;
  auto beforeLoads=PFModuleLoader::loads;
  loadPatternJob();
  assert(loadResult && PFModuleLoader::loads-beforeLoads==3 && retryPauseMs==150);
  retryPauseMs=0; PFModuleLoader::allocationFailures=99;
  beforeLoads=PFModuleLoader::loads;
  loadPatternJob();
  assert(!loadResult && PFModuleLoader::loads-beforeLoads==6 && retryPauseMs==1500);
  PFModuleLoader::allocationFailures=0; PFModuleLoader::invalidFile=true;
  retryPauseMs=0; beforeLoads=PFModuleLoader::loads;
  loadPatternJob();
  assert(!loadResult && PFModuleLoader::loads-beforeLoads==1 && retryPauseMs==0);
  delete PFLoopSync::doneSignal; delete PFLoopSync::callerLock;
  puts("PASS: reserve/fallback/fragmentation/race, deferred loop requests, stalled-loop hand-off, task failure, mutation hold, rescan and deleted selection");
}

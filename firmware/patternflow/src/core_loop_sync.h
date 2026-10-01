// ═══════════════════════════════════════════════════════════
// PatternFlow - the loop task's front door
//
// Since 3.9.1 the console's HTTP server is serviced on Core 0
// (core_net_task.h) while loop() renders on Core 1. Most handlers only read
// a few words of state, or write a value the next frame picks up, and those
// need nothing. A few do things a frame cannot survive halfway through:
// unloading the module whose draw() is executing, rebuilding the pattern
// list that draw() indexes, reconnecting the MQTT client the feature loop is
// polling, starting a show the show engine is ticking. Those come through
// here: handed to the loop task, executed at the frame boundary, the handler
// waiting for the result.
//
// The rule for a handler (feature authors: FEATURE_GUIDE.md says the same):
// if what you are about to touch is something loop() or a feature's loop()
// is using right now, wrap it in PFLoopSync::run(). When the caller is
// already the loop task — the single-core fallback, or a call from loop()
// itself — the body runs inline, so one function serves both.
//
// Not a lock, on purpose. A mutex held by loop() around the frame and taken
// by handlers would let the loop re-take it before a waiting task on the
// other core ever ran (FreeRTOS hands nothing over on give), and a handler
// holding it during a page send would stall the render exactly as it did
// before the task existed. A request executed at a known point is smaller.
//
// And not a wait without end. The loop task is on no watchdog, and a
// module's draw() runs on it: `while (a > PI) a -= 2 * PI` never returns
// once a is inf, and float32 gets there where the browser's doubles did
// not. The wait in runRaw() used to have no limit, so the first console
// request that needed the loop parked the network task behind the hung
// frame - and the server is one connection, so /api/status, /update and
// Reboot, which need nothing from the loop, went silent with it. A frozen
// panel took its own diagnosis and its own remote restart down too, and
// only the plug was left. Found by reading, in the 2026-10 core review, and
// not on a panel: the stock patterns all return, so the bench had never
// shown it (toolchain/tests/modules/_hang_probe is the module that does).
// Now a caller gives up once the loop has stopped ARRIVING
// (PF_LOOP_STALL_MS below), run() returns false, and the handler answers
// 503. That is everything this file does about a hung loop: it reports and
// it survives. Nothing here restarts anything.
//
// License: MIT
// ═══════════════════════════════════════════════════════════
#pragma once

#include <Arduino.h>
#include <type_traits>
#include "core_runtime.h"
#include "core_net_maintenance.h"

// How long the loop may go without reaching service() before a waiting
// caller stops believing in it. Measured from the loop's own stamp, not
// from how long the caller has waited: a storage transaction waits whole
// seconds for a module's setup() through runWhen() while the loop tests it
// every frame, and a loop doing that is healthy.
//
// What a healthy loop has been seen to do: 0.27 s frames during an install
// (patternflow.ino, at DT_MAX_MS) and one 2.02 s iteration when an upload
// met a load (docs/investigations/2026-09-firmware-runtime.md; that wait has
// since left the loop). What it can do on a bad day is longer and nobody
// has measured it: a feature's loop hook that fetches over HTTPS blocks in
// the name lookup until lwIP gives up, 14 s, when the router is up and the
// internet behind it is not (WiFiGenericClass::hostByName; the connect and
// the reply have 5 s each after that). The panel stands still for those
// seconds and then carries on, and that is not a hang. Twenty is clear of
// it, and no more than that: a lookup that answers late with a server that
// then does not can add up to more, and the panel will be called stalled
// until it comes back. runtime.maxUs in /api/status is the longest
// iteration since boot - the number to read off a panel on every edition
// before this is lowered, or before anything is ever allowed to ACT on it.
//
// Three long things are not in that reckoning because none of them is a
// gap between two visits to service(). The boot restore runs a module's
// setup() on this task, seconds of it for a heavy pattern, but from
// setup(), and no handler can be waiting: the server is not serviced until
// loop() itself has registered the routes (servicesReady, core_net_task.h).
// A pattern picked later is set up on the loader task, not here. And a
// format, an upload or a firmware image is written from the network task:
// the flash driver stops this core for one erase at a time and lets it
// through between them (the SDK is built with
// CONFIG_SPI_FLASH_YIELD_DURING_ERASE; read there, not timed on a panel).
//
// Too low costs a request a false 503 while the loop is merely busy; it is
// retried and nothing is lost. Too high costs only the FIRST request after
// a real hang - once the stamp is this old, every later request is turned
// away within one 25 ms slice.
#ifndef PF_LOOP_STALL_MS
#define PF_LOOP_STALL_MS 20000
#endif

namespace PFLoopSync {

inline TaskHandle_t loopTask = nullptr;           // captured by attach()
// The request, and whose it is. Non-null: posted, and still its caller's to
// take back. Null: nothing is posted, or the loop has taken it. Both sides
// move it with one atomic exchange, so a posted request goes to exactly one
// of them - to service() to run, or back to its caller - and the other reads
// null. pendingArg points into the caller's stack frame, and that exchange
// is the whole of what decides whether the frame may still be touched.
inline void (*volatile pendingFn)(void*) = nullptr;
inline bool (*pendingAttempt)(void*) = nullptr;
inline void* volatile pendingArg = nullptr;
inline SemaphoreHandle_t doneSignal = nullptr;    // binary: loop -> caller
inline SemaphoreHandle_t callerLock = nullptr;    // one request at a time

// For /api/status: how many requests came through, and the longest one
// waited. A frame is ~16 ms; a module load or a long page can hold one.
inline volatile uint32_t served = 0;
inline volatile uint32_t maxWaitUs = 0;
// ...and how many were taken back because the loop had stopped arriving.
inline volatile uint32_t gaveUp = 0;
// millis() when the loop was last at its service point, coming or going.
inline volatile uint32_t beatMs = 0;

inline void beat() {
  __atomic_store_n(&beatMs, (uint32_t)millis(), __ATOMIC_RELEASE);
}

// From the loop task, once, before any other task can call run().
inline void attach() {
  loopTask = xTaskGetCurrentTaskHandle();
  if (!doneSignal) doneSignal = xSemaphoreCreateBinary();
  if (!callerLock) callerLock = xSemaphoreCreateMutex();
  beat();
}

// True before attach() as well: with no loop task known there is nobody to
// hand the work to, so it runs where it is.
inline bool onLoopTask() {
  return loopTask == nullptr || xTaskGetCurrentTaskHandle() == loopTask;
}

// Milliseconds since the loop was last at its service point. Any task may
// ask and none needs the loop to answer - /api/status publishes it, and it
// is the one number that tells a frozen panel from a slow one.
inline uint32_t loopAgeMs() {
  if (!loopTask) return 0;
  // The stamp first, the clock second. The other way round, a beat that
  // lands between the two reads is in this reading's future, and the
  // unsigned difference comes out at 49 days: a stalled loop, on the word
  // of a loop that has just proved it is running.
  const uint32_t beatAt = __atomic_load_n(&beatMs, __ATOMIC_ACQUIRE);
  return (uint32_t)millis() - beatAt;
}

inline bool stalled() { return loopAgeMs() >= PF_LOOP_STALL_MS; }

// From loop(), at the frame boundary: run whatever is waiting.
inline void service() {
  beat();
  // Take it. From this exchange until the request is put back or signalled
  // done, its caller cannot leave: the caller's own exchange reads null.
  void (*fn)(void*) =
      __atomic_exchange_n(&pendingFn, (void (*)(void*))nullptr, __ATOMIC_ACQ_REL);
  if (!fn) return;
  // A conditional request owns its caller's storage until it completes.
  // Not ready means another frame, never a wait inside this task.
  const uint32_t startedUs = micros();
  if (pendingAttempt && !pendingAttempt(pendingArg)) {
    PFRuntime::noteSync(micros() - startedUs);
    // Back on the table, where its caller may take it back. Nothing after
    // this store may read pendingArg or pendingAttempt: by the next line
    // they can belong to a frame that has returned.
    __atomic_store_n(&pendingFn, fn, __ATOMIC_RELEASE);
    return;
  }
  fn(pendingArg);
  PFRuntime::noteSync(micros() - startedUs);
  pendingAttempt = nullptr;
  // Stamp on the way out as well. A body can be long - a page sent from
  // here, a client reconnecting - and the stamp from the way in is that
  // old by now; the next caller's first look would find a stalled loop one
  // frame before it answered.
  beat();
  xSemaphoreGive(doneSignal);
}

// Run fn(arg) on the loop task and wait for it. Inline when already there.
// False: it did not run. From another task that means the loop has stopped
// arriving and the request was taken back - it will not run later either.
inline bool runRaw(void (*fn)(void*), void* arg, bool (*attempt)(void*) = nullptr) {
  if (onLoopTask()) {
    if (attempt && !attempt(arg)) return false;
    fn(arg);
    return true;
  }
  xSemaphoreTake(callerLock, portMAX_DELAY);
  const uint32_t t0 = micros();
  pendingArg = arg;
  pendingAttempt = attempt;
  __atomic_store_n(&pendingFn, fn, __ATOMIC_RELEASE);
  // Wait in slices so a loop that has stopped servicing is visible on
  // Serial rather than a silent hang of the console.
  bool ran = true;
  uint32_t lastLogUs = t0;
  while (xSemaphoreTake(doneSignal, pdMS_TO_TICKS(25)) != pdTRUE) {
    PFNetMaintenance::poll();
    // Giving up is taking the request back, and nothing short of that. If
    // the exchange reads null the loop has it - is inside fn on this stack
    // frame right now, or has finished and is about to signal - and there
    // is no leaving before doneSignal, however old the stamp. A loop that
    // is running our call is not a dead loop in any case.
    if (stalled() &&
        __atomic_exchange_n(&pendingFn, (void (*)(void*))nullptr, __ATOMIC_ACQ_REL)) {
      ran = false;
      break;
    }
    if (micros() - lastLogUs >= 2000000) {
      Serial.println("[LOOP-SYNC] still waiting for the loop task");
      lastLogUs = micros();
    }
  }
  // Not served++: C++20 deprecates increment on a volatile-qualified type,
  // and CI builds the host tests as C++20 with -Werror. A separate read and
  // write is the same single-writer store this always was - only the task
  // holding callerLock writes it, and the reader is a status page.
  if (ran) {
    const uint32_t waited = micros() - t0;
    if (waited > maxWaitUs) maxWaitUs = waited;
    served = served + 1;
  } else {
    gaveUp = gaveUp + 1;
    Serial.printf("[LOOP-SYNC] the loop has not come round in %u ms - request withdrawn\n",
                  (unsigned)loopAgeMs());
  }
  xSemaphoreGive(callerLock);
  return ran;
}

// Any callable, captures included:  PFLoopSync::run([&] { ... });
// False means the body did not run and never will (see runRaw). A handler
// answers that with PatternflowHttp::sendLoopStalled() and leaves whatever
// the body was going to change as it found it.
//
// [[nodiscard]] because this returned nothing while the wait had no end. A
// handler written then still compiles, and on a stalled loop it goes on to
// use what its body never set - a list with no rows in it, an index still
// at -1 - or sends no reply at all. The warning is the compiler finding
// those, in this tree and in a bundle kept outside it.
template <class F>
[[nodiscard]] inline bool run(F&& f) {
  using Fn = typename std::remove_reference<F>::type;
  return runRaw([](void* p) { (*static_cast<Fn*>(p))(); }, (void*)&f);
}

// Retry a short, transactional attempt at each frame boundary. Returning
// false must leave the operation uncommitted. A caller already on the loop
// cannot wait for itself: it receives false and must retry later or reply busy.
// A caller on another task receives false only when the loop has stopped
// arriving; stalled() is how a handler tells the two apart.
template <class F>
inline bool runWhen(F&& attempt) {
  using Fn = typename std::remove_reference<F>::type;
  return runRaw([](void*) {}, (void*)&attempt,
                [](void* p) { return (*static_cast<Fn*>(p))(); });
}

}  // namespace PFLoopSync

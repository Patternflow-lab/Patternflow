// The vendored HTTP request parser - the real src/webserver/Parsing.cpp and
// WebServer.cpp - against a socket that replays a script and a clock that only
// moves when somebody sleeps.
//
// The parser runs on pf-net, pinned to Core 0 at priority 1, and this sdkconfig
// panics the board when IDLE0 has not run for 5 s. A loop in it that waits for
// the peer without sleeping is therefore a reboot, and it has been one three
// times (src/webserver/VENDORED.md): a request trickling in over a slow link,
// an upload that went quiet, a multipart body that stopped after its first
// boundary. None of them needed a handler, and nothing on a PC stood between
// any of them and a board.
//
// So every request replayed here is held to two things, whatever else its
// case is about:
//
//   it does not SPIN   the parser never looks at the socket SPIN_LOOKS times in
//                      a row and comes away empty-handed each time - no byte
//                      read, no delay() in between. That is the loop IDLE0
//                      starves behind.
//   it is not HELD     the request is over within REQUEST_BOUND_MS of fake
//                      time. This server takes one connection; a wait with no
//                      deadline is a console that does not answer.
//
// Both are thrown out of the fakes from inside the parser, because a loop that
// would never end cannot be asked to return.
//
// What a host cannot say: anything about lwIP, the heap or the stack. The
// socket here is a model (WiFiClient below says what it copies and from
// where), and so is String: the real one is not in this repository, and CI has
// no Arduino core to take it from.
#include <algorithm>
#include <cctype>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <functional>
#include <memory>
#include <string>
#include <utility>
#include <vector>
#ifdef _MSC_VER
#include <malloc.h>  // _alloca: check_parser.py says which one line needs it
#define __attribute__(x)
#endif

namespace bench {
// A request cut off on its way out asks a dead socket a handful of times - for
// the line that was cut, the line after it, and the multipart opener's three
// tries, two looks each - and that count has a ceiling the fuzz below measures
// (10). A spin has none: the watchdog bites after 5 s of it. 64 keeps the two
// apart without pinning the parser's shape.
constexpr unsigned SPIN_LOOKS = 64;
// The stream timeout is 5 s and a request silenced in the worst place waits it
// out five times over (a header line, the line after it, the multipart
// opener's three tries): 25 s, also measured below. Past 30 s nothing in the
// parser is counting.
constexpr uint32_t REQUEST_BOUND_MS = 30000;
constexpr uint32_t EPOCH_MS = 1000;

struct Spin {};
struct Held {};
static uint32_t nowMs = EPOCH_MS, beganMs = EPOCH_MS;
static unsigned idleLooks = 0, worstLooks = 0, sleeps = 0, polls = 0;

static void consumed() { idleLooks = 0; }
static void looked() {
  worstLooks = std::max(worstLooks, ++idleLooks);
  if (idleLooks >= SPIN_LOOKS) throw Spin{};
}
}  // namespace bench

static unsigned long millis() { return bench::nowMs; }
static void delay(uint32_t ms) {
  // delay(0) is a yield, and a yield lets equal priorities run: IDLE0 is below
  // pf-net and starves through it just the same.
  if (!ms) return;
  bench::nowMs += ms;
  ++bench::sleeps;
  bench::idleLooks = 0;
  if (bench::nowMs - bench::beganMs > bench::REQUEST_BOUND_MS) throw bench::Held{};
}
static void yield() {}
namespace PFNetMaintenance {
static void poll() { ++bench::polls; }
}

// ---- Arduino, as much of it as the server touches --------------------------

class __FlashStringHelper;
#define PROGMEM
#define PSTR(s) (s)
#define F(s) (reinterpret_cast<const __FlashStringHelper*>(s))
#define FPSTR(p) (reinterpret_cast<const __FlashStringHelper*>(p))
#define strlen_P strlen
#define strcpy_P strcpy
#define memccpy_P memccpy
#define log_v(...) ((void)0)
#define log_d(...) ((void)0)
#define log_i(...) ((void)0)
#define log_w(...) ((void)0)
#define log_e(...) ((void)0)
typedef const char* PGM_P;
typedef const void* PGM_VOID_P;
typedef bool boolean;

// Arduino's String where the parser leans on it. The parts that matter are the
// ones std::string does differently: substring() clamps and swaps its bounds
// instead of throwing (the parser hands it -1 + 2 and length() - 1 of an empty
// line without looking), indexOf() past the end is -1, comparisons stop at a
// NUL, and toInt() is a 32-bit long.
//
// Compared with the real cores/esp32/WString.cpp (2.0.17) when it was written,
// both built on a PC and run through every one of these operations over 40
// strings - request lines, boundaries, empty, padded, with a NUL, with high
// bytes - and every in- and out-of-range index: the transcripts were the same
// but for replace() on a string that holds a NUL, where the real class loses
// track of its own length. The server calls replace() once, to take the
// quotes off a boundary. (toInt() was only comparable inside 32 bits: a PC's
// long is wider than the device's, which is why this one clamps.)
class String {
  std::string s;
  static int low(char c) { return std::tolower(static_cast<unsigned char>(c)); }
  static bool space(char c) { return std::isspace(static_cast<unsigned char>(c)) != 0; }

public:
  String(const char* c = "") : s(c ? c : "") {}
  String(const __FlashStringHelper* f) : s(reinterpret_cast<const char*>(f)) {}
  explicit String(char c) : s(1, c) {}
  explicit String(unsigned char v) : s(std::to_string(v)) {}
  explicit String(int v) : s(std::to_string(v)) {}
  explicit String(unsigned int v) : s(std::to_string(v)) {}
  explicit String(long v) : s(std::to_string(v)) {}
  explicit String(unsigned long v) : s(std::to_string(v)) {}
  explicit String(long long v) : s(std::to_string(v)) {}
  explicit String(unsigned long long v) : s(std::to_string(v)) {}

  unsigned int length() const { return static_cast<unsigned int>(s.size()); }
  const char* c_str() const { return s.c_str(); }

  String& operator+=(const String& r) { s += r.s; return *this; }
  String& operator+=(const char* c) { if (c) s += c; return *this; }
  String& operator+=(char c) { s += c; return *this; }

  bool equals(const String& o) const { return s.size() == o.s.size() && std::strcmp(c_str(), o.c_str()) == 0; }
  bool equals(const char* c) const {
    if (s.empty()) return !c || !*c;
    return c ? std::strcmp(c_str(), c) == 0 : s[0] == 0;
  }
  bool operator==(const String& o) const { return equals(o); }
  bool operator==(const char* c) const { return equals(c); }
  bool operator!=(const String& o) const { return !equals(o); }
  bool operator!=(const char* c) const { return !equals(c); }
  bool equalsConstantTime(const String& o) const { return equals(o); }
  bool equalsIgnoreCase(const String& o) const {
    if (s.size() != o.s.size()) return false;
    const char* a = c_str();
    const char* b = o.c_str();
    while (*a) if (low(*a++) != low(*b++)) return false;
    return true;
  }
  bool startsWith(const String& p) const {
    return s.size() >= p.s.size() && std::strncmp(c_str(), p.c_str(), p.s.size()) == 0;
  }
  bool endsWith(const String& p) const {
    return s.size() >= p.s.size() && std::strcmp(c_str() + (s.size() - p.s.size()), p.c_str()) == 0;
  }

  char charAt(unsigned int i) const { return (*this)[i]; }
  char operator[](unsigned int i) const { return i < s.size() ? s[i] : 0; }
  char& operator[](unsigned int i) {
    static char outside;
    return i < s.size() ? s[i] : (outside = 0);
  }

  int indexOf(char c, unsigned int from = 0) const {
    if (from >= s.size()) return -1;
    const char* at = std::strchr(c_str() + from, c);
    return at ? static_cast<int>(at - c_str()) : -1;
  }
  int indexOf(const String& n, unsigned int from = 0) const {
    if (from >= s.size()) return -1;
    const char* at = std::strstr(c_str() + from, n.c_str());
    return at ? static_cast<int>(at - c_str()) : -1;
  }
  String substring(unsigned int left, unsigned int right = ~0u) const {
    if (left > right) std::swap(left, right);
    String out;
    if (left >= s.size()) return out;
    out.s = s.substr(left, std::min<size_t>(right, s.size()) - left);
    return out;
  }

  void trim() {
    size_t b = 0, e = s.size();
    while (b < e && space(s[b])) ++b;
    while (e > b && space(s[e - 1])) --e;
    s = s.substr(b, e - b);
  }
  void replace(const String& find, const String& with) {
    if (find.s.empty()) return;
    for (size_t at = 0; (at = s.find(find.s, at)) != std::string::npos; at += with.s.size())
      s.replace(at, find.s.size(), with.s);
  }
  long toInt() const {
    const long long v = std::strtoll(c_str(), nullptr, 10);
    return static_cast<long>(std::max<long long>(INT32_MIN, std::min<long long>(INT32_MAX, v)));
  }
};

// The server builds strings as String(a) + b + c and passes the result to
// functions that take a String& - which only binds because Arduino's operator+
// returns a reference to the temporary on its left. Same trick here.
class StringSumHelper : public String {
public:
  StringSumHelper(const String& v) : String(v) {}
  StringSumHelper(const char* c) : String(c) {}
};
static StringSumHelper& operator+(const StringSumHelper& l, const String& r) {
  auto& a = const_cast<StringSumHelper&>(l); a += r; return a;
}
static StringSumHelper& operator+(const StringSumHelper& l, const char* r) {
  auto& a = const_cast<StringSumHelper&>(l); a += r; return a;
}
static StringSumHelper& operator+(const StringSumHelper& l, char r) {
  auto& a = const_cast<StringSumHelper&>(l); a += r; return a;
}

// cores/esp32/Stream.cpp, the three calls stock Parsing.cpp was built on.
// timedRead() is copied as it is upstream - read() until the timeout, nothing
// between - so a parser put back on readStringUntil()/readBytes() spins here
// exactly as it did on Core 0 (VENDORED.md, Fix 2).
class Stream {
protected:
  unsigned long _timeout = 1000, _startMillis = 0;
  int timedRead() {
    _startMillis = millis();
    do {
      const int c = read();
      if (c >= 0) return c;
    } while (millis() - _startMillis < _timeout);
    return -1;
  }

public:
  virtual ~Stream() {}
  virtual int available() = 0;
  virtual int read() = 0;
  virtual int peek() = 0;
  void setTimeout(unsigned long ms) { _timeout = ms; }
  unsigned long getTimeout() { return _timeout; }
  size_t readBytes(char* buffer, size_t length) {
    size_t count = 0;
    for (int c; count < length && (c = timedRead()) >= 0; ++count) *buffer++ = static_cast<char>(c);
    return count;
  }
  size_t readBytes(uint8_t* buffer, size_t length) { return readBytes(reinterpret_cast<char*>(buffer), length); }
  String readStringUntil(char terminator) {
    String out;
    for (int c = timedRead(); c >= 0 && c != terminator; c = timedRead()) out += static_cast<char>(c);
    return out;
  }
};

namespace bench {
// One scripted connection: every byte the peer will ever send, when each run
// of them lands on the device, and whether a FIN follows the last. The peer
// keeps its own schedule - it does not wait for the parser to catch up.
struct Wire {
  std::string rx, tx;
  std::vector<std::pair<uint32_t, size_t>> lands;  // (fake ms, bytes of rx here by then), in time order
  bool closes = false;
  uint32_t closesAt = 0;
  size_t pos = 0, landed = 0, next = 0;

  size_t waiting() {
    while (next < lands.size() && lands[next].first <= nowMs) landed = lands[next++].second;
    return landed - pos;
  }
  bool gone() { return closes && closesAt <= nowMs && waiting() == 0; }
};
static std::shared_ptr<Wire> knocking;  // what WiFiServer::available() hands out next
}  // namespace bench

// libraries/WiFi/src/WiFiClient.cpp (core 2.0.17), the receive side. What is
// copied: read() is non-blocking and returns what is there; available() is the
// count; flush() discards what has arrived; connected() stays true while the
// peer is merely quiet and goes false once its FIN has been read up to (lwIP's
// recv() reports ENOTCONN then - it is what the Fix 4 reproduction on hardware
// depended on); copies share the socket; operator= does not carry Stream's
// timeout and setTimeout() takes seconds (WebServer.cpp's handleClient comment
// is about exactly that pair). Not copied, because the source does not settle
// it: what connected() answers when the FIN is in and bytes are still unread.
// Here it is true. Only _parseForm's check after a file part asks in that
// state.
class WiFiClient : public Stream {
  std::shared_ptr<bench::Wire> wire;

public:
  WiFiClient() {}
  WiFiClient(const WiFiClient&) = default;
  explicit WiFiClient(std::shared_ptr<bench::Wire> w) : wire(std::move(w)) {}
  WiFiClient& operator=(const WiFiClient& other) { wire = other.wire; return *this; }

  int available() override {
    const size_t n = wire ? wire->waiting() : 0;
    if (!n) bench::looked();
    return static_cast<int>(n);
  }
  int read(uint8_t* buf, size_t size) {
    const size_t n = wire ? std::min(size, wire->waiting()) : 0;
    if (!n) { bench::looked(); return 0; }
    std::memcpy(buf, wire->rx.data() + wire->pos, n);
    wire->pos += n;
    bench::consumed();
    return static_cast<int>(n);
  }
  int read() override {
    uint8_t byte = 0;
    return read(&byte, 1) == 1 ? byte : -1;
  }
  int peek() override {
    if (wire && wire->waiting()) return static_cast<uint8_t>(wire->rx[wire->pos]);
    bench::looked();
    return -1;
  }
  void flush() {
    if (!wire || !wire->waiting()) return;
    wire->pos = wire->landed;
    bench::consumed();
  }
  void stop() { wire.reset(); }
  uint8_t connected() {
    bench::looked();
    return wire && !wire->gone();
  }
  operator bool() { return connected(); }
  int setTimeout(uint32_t seconds) { Stream::setTimeout(seconds * 1000ul); return 0; }

  size_t write(const char* b, size_t n) { if (wire) wire->tx.append(b, n); return wire ? n : 0; }
  size_t write(const uint8_t* b, size_t n) { return write(reinterpret_cast<const char*>(b), n); }
  size_t write_P(PGM_P b, size_t n) { return write(b, n); }
  size_t write(Stream&) { return 0; }
};

struct IPAddress {};
class WiFiServer {
public:
  WiFiServer(uint16_t = 80) {}
  WiFiServer(const IPAddress&, uint16_t = 80) {}
  void begin(uint16_t = 0) {}
  void close() {}
  void setNoDelay(bool) {}
  WiFiClient available() { return WiFiClient(std::exchange(bench::knocking, nullptr)); }
};

// Compiled because WebServer.cpp is taken whole, never reached: no case here
// authenticates or serves a file.
namespace fs {
struct File : Stream {
  operator bool() { return false; }
  bool isDirectory() { return false; }
  int available() override { return 0; }
  int read() override { return -1; }
  int peek() override { return -1; }
  size_t size() { return 0; }
  const char* name() { return ""; }
};
struct FS {
  File open(const String&, const char* = "r") { return File(); }
  bool exists(const String&) { return false; }
};
}  // namespace fs
using fs::File;
using fs::FS;
struct MD5Builder {
  void begin() {}
  void add(const String&) {}
  void calculate() {}
  String toString() { return String(); }
};
static int base64_encode_expected_len(int n) { return (n + 2) / 3 * 4; }
static int base64_encode_chars(const char*, int, char* out) { *out = 0; return 0; }
static uint32_t esp_random() { return 0x5eed5eedu; }

// http_parser.h (nodejs/http-parser, MIT, as IDF 4.4 ships it): the method
// list Parsing.cpp turns into both the HTTPMethod enum and the strings it
// matches the request line against.
#define HTTP_METHOD_MAP(XX)         \
  XX(0,  DELETE,      DELETE)       \
  XX(1,  GET,         GET)          \
  XX(2,  HEAD,        HEAD)         \
  XX(3,  POST,        POST)         \
  XX(4,  PUT,         PUT)          \
  XX(5,  CONNECT,     CONNECT)      \
  XX(6,  OPTIONS,     OPTIONS)      \
  XX(7,  TRACE,       TRACE)        \
  XX(8,  COPY,        COPY)         \
  XX(9,  LOCK,        LOCK)         \
  XX(10, MKCOL,       MKCOL)        \
  XX(11, MOVE,        MOVE)         \
  XX(12, PROPFIND,    PROPFIND)     \
  XX(13, PROPPATCH,   PROPPATCH)    \
  XX(14, SEARCH,      SEARCH)       \
  XX(15, UNLOCK,      UNLOCK)       \
  XX(16, BIND,        BIND)         \
  XX(17, REBIND,      REBIND)       \
  XX(18, UNBIND,      UNBIND)       \
  XX(19, ACL,         ACL)          \
  XX(20, REPORT,      REPORT)       \
  XX(21, MKACTIVITY,  MKACTIVITY)   \
  XX(22, CHECKOUT,    CHECKOUT)     \
  XX(23, MERGE,       MERGE)        \
  XX(24, MSEARCH,     M-SEARCH)     \
  XX(25, NOTIFY,      NOTIFY)       \
  XX(26, SUBSCRIBE,   SUBSCRIBE)    \
  XX(27, UNSUBSCRIBE, UNSUBSCRIBE)  \
  XX(28, PATCH,       PATCH)        \
  XX(29, PURGE,       PURGE)        \
  XX(30, MKCALENDAR,  MKCALENDAR)   \
  XX(31, LINK,        LINK)         \
  XX(32, UNLINK,      UNLINK)
enum http_method {
#define XX(num, name, string) HTTP_##name = num,
  HTTP_METHOD_MAP(XX)
#undef XX
};

// ---- The code under test, as the firmware compiles it ----------------------
// check_parser.py lays the vendored directory out beside empty stand-ins for
// the headers above and puts it on the system include path: the server is not
// ours to make -Wextra clean (sign compares, a size_t printed with %x).
#ifdef _MSC_VER
#pragma warning(push, 0)
#endif
#include "webserver/WebServer.cpp"
#include "webserver/Parsing.cpp"
#include "webserver/detail/mimetable.cpp"
#ifdef _MSC_VER
#pragma warning(pop)
#endif

// ---- The bench --------------------------------------------------------------

namespace bench {

static std::string text(const String& v) { return std::string(v.c_str(), v.length()); }

// What the server handed its handlers, in the order it handed it, and what
// went back down the wire.
struct Seen {
  std::string log, upload, raw, reply;
  bool handled = false, uploading = false;
  bool operator==(const Seen& o) const {
    return log == o.log && upload == o.upload && raw == o.raw && reply == o.reply;
  }
};

struct Panel : WebServer {
  Panel() : WebServer(80) {}
  // ~WebServer() frees neither list. On the device the server is never
  // destroyed; here there is one per replay and LeakSanitizer is counting.
  ~Panel() override { delete[] _currentArgs; delete[] _postArgs; }
  bool hasUpload() const { return static_cast<bool>(_currentUpload); }
  bool hasRaw() const { return static_cast<bool>(_currentRaw); }
};

struct Script {
  Wire wire;
  uint32_t at = EPOCH_MS;
  Script& send(const std::string& bytes) {
    wire.rx += bytes;
    wire.lands.push_back({at, wire.rx.size()});
    return *this;
  }
  Script& wait(uint32_t ms) { at += ms; return *this; }
  Script& close() { wire.closes = true; wire.closesAt = at; return *this; }
};

struct Result {
  enum End { Returned, Spun, Held } end = Returned;
  uint32_t ms = 0;        // fake time from accept to return
  unsigned looks = 0;     // most looks at the socket in a row that found nothing
  bool unpolled = false;  // slept more often than it polled network maintenance
  Seen seen;
};

struct Bench {
  Panel server;
  Seen seen;
  const char* probe = nullptr;  // an argument asked for by name, as handlers ask

  Bench() {
    static const char* collected[] = {"X-PF-Name"};
    server.collectHeaders(collected, 1);
    // The firmware's own shapes: a multipart route and a raw route, each with
    // a body callback (core_web_update.h, core_patterns_http.h), and routes
    // with none.
    server.on("/form", HTTP_POST, [this] { handle("/form"); }, [this] { body(); });
    server.on("/raw", HTTP_PUT, [this] { handle("/raw"); }, [this] { body(); });
    server.on("/plain", HTTP_POST, [this] { handle("/plain"); });
    server.on("/plain", HTTP_DELETE, [this] { handle("/plain"); });
    server.on("/page", HTTP_GET, [this] { handle("/page"); });
    server.begin();
  }
  Bench(const Bench&) = delete;

  void line(const std::string& entry) { seen.log += entry + "\n"; }

  void handle(const char* route) {
    seen.handled = true;
    line(std::string("handle ") + route);
    for (int i = 0; i < server.args(); ++i) line("arg " + text(server.argName(i)) + "=" + text(server.arg(i)));
    if (probe) line(std::string("named ") + probe + "=" + (server.hasArg(probe) ? text(server.arg(probe)) : "(absent)"));
    if (server.hasHeader("X-PF-Name")) line("header X-PF-Name=" + text(server.header("X-PF-Name")));
    line("host " + text(server.hostHeader()));
    server.send(200, "text/plain", "ok");
  }

  // One callback per route, which is all FunctionRequestHandler has: the
  // server calls it for a multipart file's events and for a raw body's, and
  // says which only by which of upload() and raw() exists.
  void body() {
    if (server.hasUpload()) {
      HTTPUpload& up = server.upload();
      switch (up.status) {
        case UPLOAD_FILE_START:
          seen.uploading = true;
          line("upload start " + text(up.name) + " " + text(up.filename) + " " + text(up.type));
          break;
        case UPLOAD_FILE_WRITE:
          seen.upload.append(reinterpret_cast<const char*>(up.buf), up.currentSize);
          line("upload write " + std::to_string(up.currentSize));
          break;
        case UPLOAD_FILE_END:
          seen.uploading = false;
          line("upload end " + std::to_string(up.totalSize));
          break;
        case UPLOAD_FILE_ABORTED:
          seen.uploading = false;
          line("upload aborted");
          break;
      }
    } else if (server.hasRaw()) {
      // Chunk sizes follow the segments the body arrived in, so only the
      // bytes and the total are kept.
      HTTPRaw& in = server.raw();
      switch (in.status) {
        case RAW_START: line("raw start"); break;
        case RAW_WRITE: seen.raw.append(reinterpret_cast<const char*>(in.buf), in.currentSize); break;
        case RAW_END: line("raw end " + std::to_string(in.totalSize)); break;
        case RAW_ABORTED: line("raw aborted " + std::to_string(in.totalSize)); break;
      }
    }
  }

  // One connection through handleClient(), the way pf-net drives it: accepted
  // with its first bytes already here, parsed, handled, dropped.
  Result play(Script script) {
    seen = Seen();
    nowMs = beganMs = EPOCH_MS;
    idleLooks = worstLooks = sleeps = polls = 0;
    auto wire = std::make_shared<Wire>(std::move(script.wire));
    knocking = wire;
    Result r;
    try {
      server.handleClient();
    } catch (const Spin&) {
      r.end = Result::Spun;
    } catch (const Held&) {
      r.end = Result::Held;
    }
    r.ms = nowMs - beganMs;
    r.looks = worstLooks;
    r.unpolled = polls < sleeps;
    seen.reply = wire->tx;
    r.seen = seen;
    return r;
  }
};

static int failures = 0;
static void fail(const std::string& what) {
  ++failures;
  std::printf("FAIL: %s\n", what.c_str());
}

// What the vendored parser does today that this file would otherwise fail.
// Pinned in both directions: the day one stops being true the check goes red
// until the pin is deleted and the behaviour becomes a requirement.
static void known(bool stillTrue, const std::string& what) {
  if (stillTrue) std::printf("KNOWN: %s\n", what.c_str());
  else fail("no longer true - delete this pin and require the fixed behaviour: " + what);
}

static std::string printable(const std::string& bytes) {
  std::string out;
  for (unsigned char c : bytes) {
    if (c == '\n') out += "\\n";
    else if (c == '\r') out += "\\r";
    else if (c < 0x20 || c > 0x7e) { char hex[8]; std::snprintf(hex, sizeof(hex), "\\x%02x", c); out += hex; }
    else out += static_cast<char>(c);
  }
  return out;
}
static std::string shown(const Seen& s) {
  return "log \"" + printable(s.log) + "\", " + std::to_string(s.upload.size()) + " upload bytes, " +
         std::to_string(s.raw.size()) + " raw bytes, reply \"" + printable(s.reply) + "\"";
}
static std::string outcome(const Result& r) {
  if (r.end == Result::Spun)
    return "SPUN - looked at the socket " + std::to_string(SPIN_LOOKS) +
           " times in a row with no byte read and no delay() between (on pf-net: the Core-0 watchdog)";
  if (r.end == Result::Held)
    return "HELD - still parsing " + std::to_string(REQUEST_BOUND_MS) + " ms of fake time after the request began";
  return "returned after " + std::to_string(r.ms) + " ms, " + (r.seen.handled ? "handled" : "not handled");
}

// The two properties, and Fix 3's: a wait that sleeps also lets Wi-Fi and
// name maintenance run. Empty when all three hold.
static std::string unsound(const Result& r) {
  if (r.end != Result::Returned) return outcome(r);
  if (r.unpolled) return "a wait slept without PFNetMaintenance::poll() (VENDORED.md, Fix 3)";
  return "";
}
static bool ends(const std::string& name, const Result& r) {
  const std::string why = unsound(r);
  if (!why.empty()) fail(name + ": " + why);
  return why.empty();
}

// ---- Requests ---------------------------------------------------------------

static const std::string BOUNDARY = "----PFBoundary7MA4YWxk";
static const std::string OK_REPLY =
    "HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nContent-Length: 2\r\nConnection: close\r\n\r\nok";

// Every byte value, and what a byte-at-a-time boundary matcher gets wrong
// first: the boundary's own opening inside the file, once across the
// 1436-byte upload buffer.
static std::string binary(size_t n) {
  std::string b(n, '\0');
  uint32_t x = 0x2545f491u;
  for (auto& c : b) { x = x * 1664525u + 1013904223u; c = static_cast<char>(x >> 24); }
  auto plant = [&b](size_t at, const std::string& lookalike) {
    if (at + lookalike.size() <= b.size()) b.replace(at, lookalike.size(), lookalike);
  };
  plant(40, "\r\n--");
  plant(200, "\r\n--" + BOUNDARY.substr(0, BOUNDARY.size() - 1) + "X");
  plant(600, "\r\r\n--\r\n-");
  plant(1430, "\r\n--" + BOUNDARY.substr(0, 8));
  return b;
}

struct Request {
  std::string name, bytes;
  size_t body = 0;  // offset of the first body byte; bytes.size() when there is none
  Seen whole;       // what a complete delivery hands the handlers
};

static Request request(const std::string& name, const std::string& line, const std::string& headers,
                       const std::string& body, const std::string& log,
                       const std::string& upload = "", const std::string& raw = "") {
  Request q;
  q.name = name;
  q.bytes = line + "\r\n" + headers;
  if (!body.empty()) q.bytes += "Content-Length: " + std::to_string(body.size()) + "\r\n";
  q.bytes += "\r\n";
  q.body = q.bytes.size();
  q.bytes += body;
  q.whole.log = log;
  q.whole.upload = upload;
  q.whole.raw = raw;
  q.whole.reply = OK_REPLY;
  q.whole.handled = true;
  return q;
}

static const std::string MULTIPART = "Content-Type: multipart/form-data; boundary=" + BOUNDARY + "\r\n";
static std::string field(const std::string& name, const std::string& value) {
  return "--" + BOUNDARY + "\r\nContent-Disposition: form-data; name=\"" + name + "\"\r\n\r\n" + value + "\r\n";
}
static std::string file(const std::string& name, const std::string& called, const std::string& type,
                        const std::string& bytes) {
  return "--" + BOUNDARY + "\r\nContent-Disposition: form-data; name=\"" + name + "\"; filename=\"" + called +
         "\"\r\n" + (type.empty() ? "" : "Content-Type: " + type + "\r\n") + "\r\n" + bytes + "\r\n";
}
static const std::string CLOSING = "--" + BOUNDARY + "--\r\n";

struct Corpus {
  Request upload, blob, fields, urlencoded, json, put, get, del;
  std::vector<const Request*> all() const { return {&upload, &blob, &fields, &urlencoded, &json, &put, &get, &del}; }
};

static Corpus corpus() {
  const std::string pattern = binary(1500), small = binary(40);
  Corpus c;
  c.upload = request(
      "multipart, a field then a file", "POST /form?src=query HTTP/1.1", "Host: 192.168.4.1\r\n" + MULTIPART,
      field("note", "hello panel") + file("file", "wave.pfm", "application/octet-stream", pattern) + CLOSING,
      "upload start file wave.pfm application/octet-stream\nupload write 1436\nupload write 64\nupload end 1500\n"
      "handle /form\narg note=hello panel\narg src=query\nhost 192.168.4.1\n",
      pattern);
  // A file with no Content-Type of its own, named "blob" (what FormData calls
  // a Blob), followed by another part: the parser's other way out of a file.
  c.blob = request(
      "multipart, a file then a field", "POST /form?filename=late.pfm HTTP/1.1", "Host: 192.168.4.1\r\n" + MULTIPART,
      file("file", "blob", "", small) + field("note", "after the file") + CLOSING,
      "upload start file late.pfm text/plain\nupload write 40\nupload end 40\n"
      "handle /form\narg note=after the file\narg filename=late.pfm\nhost 192.168.4.1\n",
      small);
  c.fields = request(
      "multipart, fields only", "POST /plain HTTP/1.1", "Host: patternflow.local\r\n" + MULTIPART,
      field("ssid", "home net") + field("memo", "line one\r\nline two") + CLOSING,
      "handle /plain\narg ssid=home net\narg memo=line one\nline two\nhost patternflow.local\n");
  c.urlencoded = request(
      "urlencoded POST", "POST /plain?src=query HTTP/1.1",
      "Host: 192.168.4.1\r\nContent-Type: application/x-www-form-urlencoded\r\n", "a=1&b=two+words&c=%41%2f",
      "handle /plain\narg src=query\narg a=1\narg b=two words\narg c=A/\nhost 192.168.4.1\n");
  c.json = request(
      "JSON POST", "POST /plain HTTP/1.1", "Host: 192.168.4.1\r\nContent-Type: application/json\r\n",
      "{\"index\":3}", "handle /plain\narg plain={\"index\":3}\nhost 192.168.4.1\n");
  // 1500 is one full HTTP_RAW_BUFLEN and a short tail: the tail is what stock
  // waited 5 s for (VENDORED.md, Fix 1). "arg size=1500" is in the log since
  // Fix 5: stock never parsed a raw request's query string - see carriesOver().
  c.put = request(
      "raw PUT", "PUT /raw?size=1500 HTTP/1.1",
      "Host: 192.168.4.1\r\nX-PF-Name: wave.pfm\r\nContent-Type: application/octet-stream\r\n", pattern,
      "raw start\nraw end 1500\nhandle /raw\narg size=1500\nheader X-PF-Name=wave.pfm\nhost 192.168.4.1\n", "", pattern);
  c.get = request(
      "GET", "GET /page?x=1&y=two HTTP/1.1", "Host: patternflow.local\r\nX-PF-Name: probe\r\nAccept: */*\r\n", "",
      "handle /page\narg x=1\narg y=two\nheader X-PF-Name=probe\nhost patternflow.local\n");
  c.del = request(
      "DELETE, no body", "DELETE /plain?name=old HTTP/1.1", "Host: 192.168.4.1\r\n", "",
      "handle /plain\narg name=old\nhost 192.168.4.1\n");
  return c;
}

enum class Peer { Closes, Waits };  // after its last byte: a FIN, or connected and saying nothing
static const char* said(Peer p) { return p == Peer::Closes ? "then the peer closes" : "then silence, peer connected"; }

static Script cut(const std::string& bytes, size_t n, Peer then) {
  Script s;
  s.send(bytes.substr(0, n));
  if (then == Peer::Closes) s.close();
  return s;
}
static Script split(const std::string& bytes, size_t n, uint32_t gap) {
  Script s;
  s.send(bytes.substr(0, n)).wait(gap).send(bytes.substr(n));
  return s;
}

// The request arrives in full, however slowly: it parses to exactly what a
// single segment parses to, and costs the time its last byte took to arrive
// and no more (2 ms is the upload wait's step). Empty when it does.
static std::string undelivered(const Request& q, const Script& script, uint32_t lastByteMs) {
  Bench b;
  const Result r = b.play(script);
  const std::string why = unsound(r);
  if (!why.empty()) return why;
  if (!(r.seen == q.whole)) return "parsed to " + shown(r.seen) + "; expected " + shown(q.whole);
  if (r.ms < lastByteMs || r.ms > lastByteMs + 2)
    return "took " + std::to_string(r.ms) + " ms; its last byte arrived at " + std::to_string(lastByteMs);
  return "";
}
static void parses(const std::string& name, const Request& q, const Script& script, uint32_t lastByteMs) {
  const std::string why = undelivered(q, script, lastByteMs);
  if (!why.empty()) fail(name + ": " + why);
}

// The request stops short: the parser gives up, in time, without handing the
// handler a body it did not get and without a reply.
static void refuses(const std::string& name, const Script& script, const std::string& log = "") {
  Bench b;
  const Result r = b.play(script);
  if (!ends(name, r)) return;
  if (r.seen.handled || !r.seen.reply.empty() || r.seen.log != log)
    fail(name + ": expected no handler, no reply and log \"" + printable(log) + "\"; got " + shown(r.seen));
}

// A body callback told that a body began, and never told how it ended. The
// firmware's callbacks latch at the start - storage busy and the panel
// paused, the UPDATE card up - and let go only on an end or an abort.
static bool dropped(const Seen& s) {
  const bool began = s.log.find("upload start") != std::string::npos || s.log.find("raw start") != std::string::npos;
  return began && !s.handled && s.log.find(" aborted") == std::string::npos;
}

static Script whole(const Request& q) { return cut(q.bytes, q.bytes.size(), Peer::Waits); }

static void complete(const Corpus& c) {
  // The peer stays connected and waits for its answer, as a browser does. A
  // parser that waits for more than was promised shows up as fake time.
  for (const Request* q : c.all()) parses(q->name, *q, whole(*q), 0);
  if (!failures)
    std::printf("PASS: %u well-formed requests reach their handlers whole and cost no fake time\n",
                static_cast<unsigned>(c.all().size()));
}

static void truncated(const Corpus& c) {
  const int before = failures;
  const std::string head = "POST /form HTTP/1.1\r\nHost: 192.168.4.1\r\n" + MULTIPART + "\r\n";
  const std::string opened = head + "--" + BOUNDARY + "\r\n";
  const std::string disposition = "Content-Disposition: form-data; name=\"note\"\r\n";
  for (Peer then : {Peer::Closes, Peer::Waits}) {
    const std::string tail = std::string(", ") + said(then);
    // Fix 4's request: the part-header loop had no way out but a part.
    refuses("multipart: the first boundary" + tail, cut(opened, opened.size(), then));
    // ...and its other loop, which also grew the value by a byte a pass.
    const std::string value = opened + disposition + "\r\nhello pan";
    refuses("multipart: a field value that never reaches its boundary" + tail, cut(value, value.size(), then));
    const std::string midHeader = opened + disposition.substr(0, 31);
    refuses("multipart: a part header cut mid-line" + tail, cut(midHeader, midHeader.size(), then));
    const std::string midLine = head.substr(0, head.find("boundary=") + 4);
    refuses("multipart: the request's header block cut mid-line" + tail, cut(midLine, midLine.size(), then));
    refuses("multipart: headers and no body" + tail, cut(head, head.size(), then));
    // A file delivered in full, and then the form stops: the callback that
    // was told the file ended is told the upload did not.
    refuses("multipart: a field cut short after a whole file" + tail,
            cut(c.blob.bytes, c.blob.bytes.find("after the file") + 5, then),
            "upload start file late.pfm text/plain\nupload write 40\nupload end 40\nupload aborted\n");

    // A GET whose head stops is still handled (stock: nothing arriving ends
    // the header block). Only the two properties are asked of it.
    Bench b;
    ends("GET: the header block cut mid-line" + tail, b.play(cut(c.get.bytes, c.get.bytes.find("X-PF-Name") + 6, then)));

    refuses("raw PUT: a body shorter than its Content-Length" + tail, cut(c.put.bytes, c.put.body + 700, then),
            "raw start\nraw aborted 700\n");
    refuses("urlencoded POST: a body shorter than its Content-Length" + tail,
            cut(c.urlencoded.bytes, c.urlencoded.bytes.size() - 5, then));

    // A boundary far past the 70 characters a boundary may have. Stock sized
    // a stack array from it - 9,005 bytes on an 8 KB task stack, a reboot on
    // the board and a stack overflow here under the sanitizers (Fix 5).
    const std::string wide(9000, 'B');
    const std::string oversized = "POST /form HTTP/1.1\r\nHost: 192.168.4.1\r\nContent-Type: multipart/form-data; boundary=" +
                                  wide + "\r\n\r\n--" + wide +
                                  "\r\nContent-Disposition: form-data; name=\"file\"; filename=\"a.pfm\"\r\n\r\nxx";
    refuses("multipart: a 9,000-character boundary" + tail, cut(oversized, oversized.size(), then));
  }

  // A closing boundary without its CR/LF still closes the form. With the peer
  // gone that is immediate; with the peer waiting the parser sits out one
  // stream timeout for a line ending that is not coming, then answers. (After
  // a file the parser asks connected() with the "--" still unread, the one
  // state the socket model does not vouch for, so the form that ends in a
  // file is only asked about with the peer still there.)
  parses(c.fields.name + ": closing boundary without CR/LF, then the peer closes", c.fields,
         cut(c.fields.bytes, c.fields.bytes.size() - 2, Peer::Closes), 0);
  parses(c.fields.name + ": closing boundary without CR/LF, then silence", c.fields,
         cut(c.fields.bytes, c.fields.bytes.size() - 2, Peer::Waits), 5000);
  parses(c.upload.name + ": closing boundary without CR/LF, then silence", c.upload,
         cut(c.upload.bytes, c.upload.bytes.size() - 2, Peer::Waits), 5000);
  if (failures == before)
    std::puts("PASS: a multipart, raw or urlencoded body that stops short is refused without a spin, closed or silent; "
              "a closing boundary needs no CR/LF");
}

static void slow(const Corpus& c) {
  const int before = failures;
  // An upload that goes quiet mid-file and comes back. The wait for it is
  // _uploadReadByte()'s, the loop that lost its braces (VENDORED.md,
  // 2026-09-10) and spun for as long as the peer said nothing.
  parses("multipart: 300 ms of silence inside the file", c.upload, split(c.upload.bytes, c.upload.body + 900, 300), 300);
  parses("raw PUT: 300 ms of silence inside the body", c.put, split(c.put.bytes, c.put.body + 900, 300), 300);
  // A link that delivers one byte every 3 ms: Fix 2's case, where the stream
  // timeout never fires because the gap between two bytes is always short.
  for (const Request* q : c.all()) {
    Script s;
    for (char byte : q->bytes) s.send(std::string(1, byte)).wait(3);
    parses(q->name + ": one byte every 3 ms", *q, s, static_cast<uint32_t>(3 * (q->bytes.size() - 1)));
  }
  if (failures == before)
    std::puts("PASS: stalled and trickled requests parse to the same thing, every wait sleeping and polling");
}

// Every prefix of every request, ended both ways, and every two-segment
// delivery of it. Deterministic: the corpus is fixed and the cut points are
// all of them.
static void fuzz(const Corpus& c) {
  unsigned replays = 0, mostLooks = 0, quietUploads = 0;
  uint32_t longestMs = 0;
  for (const Request* each : c.all()) {
    const Request& q = *each;
    for (Peer then : {Peer::Closes, Peer::Waits}) {
      unsigned bad = 0;
      std::string first;
      for (size_t n = 1; n < q.bytes.size(); ++n, ++replays) {
        Bench b;
        const Result r = b.play(cut(q.bytes, n, then));
        std::string why;
        if (r.end == Result::Held && r.seen.uploading) {
          ++quietUploads;  // pinned below
        } else if (!unsound(r).empty()) {
          why = unsound(r);
        } else if (n >= q.body && r.seen.handled && !(r.seen == q.whole)) {
          // A head that stops is a request without a body (stock). A body
          // that stops must not reach the handler looking finished.
          why = "handled a body that stopped short: " + shown(r.seen);
        } else if (dropped(r.seen)) {
          why = "gave the request up without telling the body callback: " + shown(r.seen);
        }
        if (r.end == Result::Returned) {
          mostLooks = std::max(mostLooks, r.looks);
          longestMs = std::max(longestMs, r.ms);
        }
        if (!why.empty() && !bad++) first = "cut after byte " + std::to_string(n) + ", " + said(then) + ": " + why;
      }
      if (bad)
        fail("fuzz, " + q.name + ": " + std::to_string(bad) + " of " + std::to_string(q.bytes.size() - 1) +
             " truncations fail; the first is " + first);
    }
    unsigned bad = 0;
    std::string first;
    for (size_t n = 1; n < q.bytes.size(); ++n, ++replays) {
      const std::string why = undelivered(q, split(q.bytes, n, 40), 40);
      if (!why.empty() && !bad++) first = "split after byte " + std::to_string(n) + ": " + why;
    }
    if (bad)
      fail("fuzz, " + q.name + ": " + std::to_string(bad) + " of " + std::to_string(q.bytes.size() - 1) +
           " two-segment deliveries (40 ms apart) fail; the first is " + first);
  }
  // The absence of a deadline in _uploadReadByte() is stock and was left alone
  // on purpose when its braces were fixed ("a separate decision from
  // yielding", Parsing.cpp). It sleeps every pass, so it is not the watchdog;
  // it is the single connection held by an uploader that vanished without a
  // FIN, until TCP keepalive notices - by lwIP's defaults (7,200 s idle, then
  // nine probes 75 s apart) a little over two hours. Derived, not measured.
  known(quietUploads > 0,
        std::to_string(quietUploads) + " truncations leave a file part open with the peer silent, and the upload wait "
        "has no deadline: HELD past " + std::to_string(REQUEST_BOUND_MS) + " ms (sleeping, not spinning)");
  if (mostLooks >= SPIN_LOOKS / 2 || longestMs > REQUEST_BOUND_MS - 5000)
    fail("the bounds have lost their margin: a truncated request now looks at a dead socket " +
         std::to_string(mostLooks) + " times in a row, or waits " + std::to_string(longestMs) + " ms");
  std::printf("%s: %u replays - every truncation point of every request, closed and silent, and every two-segment "
              "delivery; the longest wait that ended was %u ms, the most looks at a dead socket %u\n",
              failures ? "DONE" : "PASS", replays, static_cast<unsigned>(longestMs), mostLooks);
}

// One server, several requests: what a request leaves behind for the next.
static void carriesOver(const Corpus& c) {
  {
    Bench b;
    b.play(whole(c.get));
    b.probe = "x";
    const Result r = b.play(whole(c.fields));
    if (ends("a form after a GET", r) && r.seen.log.find("named x=(absent)") == std::string::npos)
      fail("a form after a GET still sees the GET's arguments: " + shown(r.seen));
  }
  {
    // _parseForm() gives its fields to the request only when the form
    // completes, and arg() and hasArg() look in _postArgs first. A form
    // refused after a field used to leave it there, answering for the
    // arguments of every plain request until the next multipart one (Fix 4).
    Bench b;
    const std::string aborted = "POST /form HTTP/1.1\r\nHost: 192.168.4.1\r\n" + MULTIPART + "\r\n" +
                                field("note", "left behind") + file("file", "wave.pfm", "", "stops here");
    b.play(cut(aborted, aborted.size(), Peer::Closes));
    b.probe = "note";
    const Result r = b.play(whole(c.get));
    if (ends("a GET after a refused form", r) && r.seen.log.find("named note=(absent)") == std::string::npos)
      fail("a GET after a refused form is answered with the form's field: " + shown(r.seen));
  }
  {
    // The raw path used not to call _parseArguments(), so a raw request had
    // no arguments of its own and args()/arg() answered with the previous
    // request's. core_web_update.h asks a raw PUT for "size" (Fix 5).
    Bench b;
    b.play(whole(c.get));
    b.probe = "size";
    const Result r = b.play(whole(c.put));
    if (ends("a raw PUT after a GET", r) &&
        (r.seen.log.find("arg x=1\n") != std::string::npos || r.seen.log.find("named size=1500") == std::string::npos))
      fail("a raw PUT after a GET does not see its own query string, or still sees the GET's: " + shown(r.seen));
  }
  {
    // FunctionRequestHandler::canRaw() is true for any route with a body
    // callback that is not a GET, whatever the callback was written for. A
    // POST that is not multipart, sent to a multipart route, used to be
    // delivered to the upload callback as a raw body, where upload() is a
    // null reference: core_web_update.h and core_patterns_http.h read
    // .status through it, and `curl -X POST /api/patterns` panicked a board.
    // It is a plain request now: handled, and no body callback (Fix 5).
    Bench b;
    const Request post = request("", "POST /form HTTP/1.1", "Host: 192.168.4.1\r\nContent-Type: text/plain\r\n", "x=1", "");
    const Result r = b.play(whole(post));
    if (ends("a POST that is not multipart, to a multipart route", r) &&
        (!r.seen.handled || r.seen.log.find("raw start") != std::string::npos ||
         r.seen.log.find("upload ") != std::string::npos))
      fail("a POST that is not multipart, to a route with an upload callback, reached that callback or was not "
           "handled: " + shown(r.seen));
  }
}

}  // namespace bench

int main() {
  using namespace bench;
  const Corpus requests = corpus();
  complete(requests);
  truncated(requests);
  slow(requests);
  fuzz(requests);
  carriesOver(requests);
  std::fflush(stdout);
  if (failures) {
    std::printf("%d failure(s)\n", failures);
    std::fflush(stdout);
    // A replay that tripped was thrown out of the parser mid-allocation. The
    // leak report that would follow says nothing the lines above have not.
    std::_Exit(1);
  }
  return 0;
}

/**
 * GET and POST /api/mqtt (docs/rest-api.md lines 343 to 367, docs/mqtt-spec.md lines 11 and 13) and the three mqtt
 * fields in /api/status (rest-api.md lines 66 and 111), on mqtt.ts's client. The spec where it speaks,
 * features/mqtt/core_mqtt_http.h where it is silent: the channel argument, the short words for a role or a channel,
 * /api/mqtt/config and /api/mqtt/forget, and the error texts. mqtt.ts has no Director or FlowLocal, so mode is
 * always "normal", each normal* field is its plain twin, and their routes are the 404.
 */
import type { Reply } from "../http";
import type { Transport } from "../panel";
import { mqtt, type Channel, type Role } from "./mqtt";

const [PORT, PREFIX] = [1883, "patternflow"]; // PF_MQTT_PORT and PF_MQTT_PREFIX, what configOnLoop() takes for one not sent
const ROLES = new Map<string, Role>([
  ["publisher", "publisher"], ["pub", "publisher"], ["subscriber", "subscriber"], ["sub", "subscriber"], ["off", "off"], ["none", "off"],
]);
// channelFromName(): a name it does not know, custom among them, is Custom.
const CHANNELS = new Map<string, Channel>([
  ["off", "off"], ["none", "off"], ["broadcast", "broadcast"], ["bc", "broadcast"], ["live", "live"], ["ch5", "live"], ["5", "live"],
]);
for (const n of [1, 2, 3, 4]) CHANNELS.set(`ch${n}`, `ch${n}` as Channel).set(`${n}`, `ch${n}` as Channel);
const BROKER = ["host", "port", "user", "pass", "password", "prefix"]; // the spec's password is the firmware's pass

const toInt = (v: string) => parseInt(v.trim(), 10) || 0; // String::toInt(): leading digits, else 0
const fail = (error: string): Reply => ({ status: 400, body: { ok: false, error } });
const portOf = (args: URLSearchParams, was: number) => (args.has("port") ? toInt(args.get("port")!) : was);
const badPort = (port: number) => port < 1 || port > 65535;

export default {
  feature: "mqtt",
  caps: [], // mqtt.ts gives "mqtt"
  attach({ sim, routes, status }) {
    // mqtt.ts sorts after this file and attaches after it, so the client is looked up when a request comes in.
    const client = () => mqtt(sim)!;
    // sendStatus(): the client's fields, what Director mode would overlay, and the bus.
    const reply = (): Reply => {
      const r = client().read();
      const { params, paramActive } = sim.knobState();
      const normal = { normalHost: r.host, normalUser: r.user, normalPrefix: r.prefix, normalPort: r.port, normalHasPassword: r.hasPassword };
      return { body: { ok: true, ...r, mode: "normal", directorHost: "", flowLocalHost: "", ...normal, params, paramActive } };
    };
    // configOnLoop(): each field trimmed but the password, and an empty password keeps the one set. was fills what is not sent.
    const save = (args: URLSearchParams, was: { host: string; port: number; user: string; prefix: string }) => {
      const get = (k: string) => args.get(k)?.trim();
      const [pass, prefix] = [args.get("pass") || args.get("password") || null, args.has("prefix") ? get("prefix") || PREFIX : was.prefix];
      client().saveConfig(get("host") ?? was.host, portOf(args, was.port), get("user") ?? was.user, pass, prefix);
    };

    routes("GET", "/api/mqtt", reply);
    // postOnLoop(): a channel, with the role it prefers, or a role alone on the channel it is on (Broadcast for off).
    // The spec sets the broker here too (mqtt-spec.md line 11). A field not sent stays as it is, and the broker is
    // saved after the channel: prefix=room&role=subscriber on a panel that is off ends on room, where the other
    // order would put it on Broadcast's prefix.
    routes("POST", "/api/mqtt", ({ args }) => {
      const [channel, role, broker] = [args.get("channel")?.toLowerCase(), args.get("role")?.toLowerCase(), BROKER.some((k) => args.has(k))];
      if (channel === undefined && role === undefined && !broker) return fail("channel or role required");
      // Beside a channel a word it does not know keeps the role; alone, an empty one is off and anything else is refused.
      const alone = channel === undefined && role !== undefined ? (role === "" ? "off" : ROLES.get(role)) : undefined;
      if (channel === undefined && role !== undefined && !alone) return fail("role must be off, publisher, or subscriber");
      if (broker && badPort(portOf(args, PORT))) return fail("port must be 1-65535");
      const was = client().read();
      if (channel !== undefined) client().applyChannel(CHANNELS.get(channel) ?? "custom", ROLES.get(role ?? "") ?? was.role);
      else if (alone) client().applyChannel(alone === "off" ? "off" : was.channel === "off" ? "broadcast" : was.channel, alone);
      if (broker) save(args, client().read());
      return reply();
    });
    // The device's own MQTT page saves the broker here, and anything not sent goes back to its default.
    routes("POST", "/api/mqtt/config", ({ args }) => {
      if (badPort(portOf(args, PORT))) return fail("port must be 1-65535");
      save(args, { host: "", port: PORT, user: "", prefix: PREFIX });
      return reply();
    });
    // forgetOnLoop(): clearConfig(), the password with it, then channel and role off.
    routes("POST", "/api/mqtt/forget", () => {
      client().saveConfig("", PORT, "", "", PREFIX);
      client().applyChannel("off", "off");
      return reply();
    });

    // appendStatus(): role and connection, never the broker or its credentials.
    status.push(() => {
      const { role, state, connected } = client().read();
      return { mqttRole: role, mqttState: state, mqttConnected: connected };
    });
  },
} satisfies Transport;

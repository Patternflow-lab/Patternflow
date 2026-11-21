import { evaluate } from "@mdx-js/mdx";
import { Fragment, type ComponentProps, type ComponentType } from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import JournalImage from "./JournalImage";

type MdxContentProps = {
  source: string;
};

function JournalVideo(props: ComponentProps<"video">) {
  return (
    <video {...props} preload={props.autoPlay ? "metadata" : props.preload ?? "metadata"} />
  );
}

// A post writes its figures as JSX: <figure><img src alt /></figure>. MDX
// gives the `components` map to markdown syntax only, so ![]() would have
// become a JournalImage and <img> never did. Every picture in the journal
// went out as the file in public/, whole, at once and with no dimensions:
// one post (v1-30-days) cost a phone 20.6 MB on load. The tag is swapped
// here, in the runtime MDX calls for every element however it was written,
// so the posts stay as they are.
function journalElement(type: unknown): unknown {
  if (type === "img") return JournalImage;
  if (type === "video") return JournalVideo;
  return type;
}

type JsxRuntime = (type: unknown, props: unknown, key?: string) => React.JSX.Element;

const swapJsx: JsxRuntime = (type, props, key) =>
  (jsx as JsxRuntime)(journalElement(type), props, key);
const swapJsxs: JsxRuntime = (type, props, key) =>
  (jsxs as JsxRuntime)(journalElement(type), props, key);

export default async function MdxContent({ source }: MdxContentProps) {
  const { default: Content } = (await evaluate(source, {
    Fragment,
    jsx: swapJsx,
    jsxs: swapJsxs,
    baseUrl: import.meta.url,
  })) as { default: ComponentType };

  return <Content />;
}

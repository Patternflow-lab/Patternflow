/**
 * check:features: the rows of /features against the feature folders. Every
 * id in features-data.ts is a directory under firmware/patternflow/features/,
 * and every directory there has a row. The ids that are not folders are the
 * ones the comment on Feature.id names in quotes, today "core", the panel
 * itself. They are read from there, not copied here.
 */
import ts from "typescript";

import { FEATURES } from "../../src/app/features/features-data";
import { compare, done, read, tracked } from "./_lib";

const DATA = "web/src/app/features/features-data.ts";
const DIR = "firmware/patternflow/features/";

const source = ts.createSourceFile(DATA, read(DATA), ts.ScriptTarget.Latest, true);
const type = source.statements.find((s) => ts.isTypeAliasDeclaration(s) && s.name.text === "Feature");
const id = type && ts.isTypeAliasDeclaration(type) && ts.isTypeLiteralNode(type.type)
  ? type.type.members.find((m) => m.name?.getText() === "id")
  : undefined;
const comment = id ? ts.getJSDocCommentsAndTags(id).map((d) => ts.getTextOfJSDocComment(d.comment) ?? "").join(" ") : "";
const notFolders = new Set([...comment.matchAll(/"([^"]+)"/g)].map((m) => m[1]));
console.log(`ids that are not folders, by the comment on Feature.id: ${[...notFolders].join(", ") || "(none)"}`);

const folders = tracked(DIR).map((f) => f.slice(DIR.length).split("/")).filter((parts) => parts.length > 1).map((parts) => parts[0]);
compare(
  "features",
  { label: `ids in ${DATA}`, items: FEATURES.map((f) => f.id).filter((x) => !notFolders.has(x)) },
  { label: `folders in ${DIR}`, items: new Set(folders) },
);
done();

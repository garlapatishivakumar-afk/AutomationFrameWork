import fs from "fs";
import { parseCSharp } from "./FrameworkEditor/CSharpParser";

const content = fs.readFileSync(
    "PageActions/LoginMethods.cs",
    "utf8"
);

const parsed = parseCSharp(content);

console.log(parsed);
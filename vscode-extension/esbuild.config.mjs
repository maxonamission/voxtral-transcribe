import esbuild from "esbuild";
import process from "process";
import fs from "fs";
import path from "path";

const prod = process.argv[2] === "production";

// Copy static assets (webview HTML) to dist/
function copyAssets() {
	const src = "src/webview/recorder.html";
	const dest = "dist/webview/recorder.html";
	fs.mkdirSync(path.dirname(dest), { recursive: true });
	fs.copyFileSync(src, dest);
}

const context = await esbuild.context({
	entryPoints: ["src/extension.ts"],
	bundle: true,
	external: ["vscode"],
	format: "cjs",
	target: "es2022",
	platform: "node",
	logLevel: "info",
	sourcemap: prod ? false : "inline",
	treeShaking: true,
	outfile: "dist/extension.js",
});

copyAssets();

if (prod) {
	await context.rebuild();
	process.exit(0);
} else {
	await context.watch();
}

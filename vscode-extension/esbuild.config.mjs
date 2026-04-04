import esbuild from "esbuild";
import process from "process";

const prod = process.argv[2] === "production";

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

if (prod) {
	await context.rebuild();
	process.exit(0);
} else {
	await context.watch();
}

import esbuild from "esbuild";
import process from "process";

const watch = process.argv.includes("--watch");

const context = await esbuild.context({
	entryPoints: ["static/src/main.js"],
	bundle: true,
	format: "iife",
	target: "es2020",
	logLevel: "info",
	sourcemap: watch ? "inline" : false,
	outfile: "static/app.js",
});

if (watch) {
	await context.watch();
	console.log("Watching for changes...");
} else {
	await context.rebuild();
	process.exit(0);
}

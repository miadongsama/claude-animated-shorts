import { Config } from "@remotion/cli/config";

// three.js needs a real GPU path in headless Chrome
Config.setChromiumOpenGlRenderer((process.env.REMOTION_GL as "angle" | "swangle" | undefined) ?? "angle"); // REMOTION_GL=swangle without a GPU
Config.setVideoImageFormat("jpeg");

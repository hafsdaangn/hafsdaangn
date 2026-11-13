import sharp from "sharp";

// Render the same full logo as the landing page; PNG works across link crawlers.
const logo = await sharp("public/brand/logo.svg", { density: 144 })
  .trim()
  .resize({ width: 760, height: 440, fit: "inside" })
  .png()
  .toBuffer();

await sharp({
  create: {
    width: 1200,
    height: 630,
    channels: 3,
    background: "#ffffff",
  },
})
  .composite([{ input: logo, gravity: "centre" }])
  .png()
  .toFile("public/brand/og.png");

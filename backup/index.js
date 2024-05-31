const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");

async function runAndLoggedIn() {
  const extensionPath = path.resolve(__dirname, "inject file");

  const browser = await puppeteer.launch({
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });

  const browserWSEndpoint = browser.wsEndpoint();
  fs.writeFile("browserWSEndpoint.txt", browserWSEndpoint, (err) => {
    if (err) {
      console.error("Error writing file:", err);
      return;
    }
  });

  const pages = await browser.pages();
  const page = await browser.newPage();
  pages[0].close();

  await page.setViewport({ width: 1920, height: 1080 });
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.102 Safari/537.36"
  );

  try {
    const cookieData = fs.readFileSync("Cookies.json");
    const customCookies = JSON.parse(cookieData);

    // Set each custom cookie
    for (const cookie of customCookies) {
      await page.setCookie(cookie);
    }

    await page.exposeFunction("notify", (msg) => {
      console.log(msg);
      if (msg.state == "open" && msg.connected == true) {
        // console.log("Send request for runcode");
      }
    });

    // page.on("console", (msg) => {
    //   console.log(`Console ${msg.type()}: ${msg.text()}`);
    // });

    // Navigate to the website
    await page.goto("https://qxbroker.com/en/demo-trade");

    await page.waitForFunction(() => window.WebSocket);
    await page.waitForFunction(() => window.trackedWebSockets);
  } catch (error) {
    console.error("An error occurred:", error);
  } finally {
    // await browser.close();
  }
}

runAndLoggedIn();

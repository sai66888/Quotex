const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");

// Trading options
let option = {
  amount: 1,
  time: 5,
  action: "call",
  isDemo: 1,
  tournamentId: 0,
  requestId: 1713314207,
  optionType: 100,
  loopIt: "Infinity",
};

let openTradeCount = 0;
let lossStreakCount = 0;
let countgoal = 1;
let reached = false;
let up = false;
let dummy = true;
let browser;
let page;
let wsObj; // Store WebSocket object for reconnection

// Main function to initialize browser and start trading
async function runAndLoggedIn() {
  await initializeBrowser();
  await loginAndTrade();
}

// Initialize the Puppeteer browser
async function initializeBrowser() {
  const extensionPath = path.resolve(__dirname, "inject file");
  browser = await puppeteer.launch({
    headless: true,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
    timeout: 0, // Disable timeout
    protocolTimeout: 300000, // Increase protocol timeout to 5 minutes
  });

  const browserWSEndpoint = browser.wsEndpoint();
  fs.writeFileSync("browserWSEndpoint.txt", browserWSEndpoint);

  const pages = await browser.pages();
  page = await browser.newPage();
  pages[0].close();

  await page.setViewport({ width: 1920, height: 1080 });
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.102 Safari/537.36"
  );
}

// Log in to the trading platform and start the trading loop
async function loginAndTrade() {
  try {
    const cookieData = fs.readFileSync("Cookies.json");
    const customCookies = JSON.parse(cookieData);

    for (const cookie of customCookies) {
      await page.setCookie(cookie);
    }

    await page.exposeFunction("notify", (msg) => {
      console.log(msg);
    });

    await page.goto("https://qxbroker.com/en/demo-trade");

    await page.waitForFunction(() => window.WebSocket);
    await page.waitForFunction(() => window.trackedWebSockets);

    await page.exposeFunction("runcode", (msg) => {
      if (msg.state == "runcode") {
        console.log(msg.data);
      }
    });

    await page.waitForSelector(
      ".trading-chart_assets .asset-select button.asset-select_button"
    );

    await page.evaluate(() => {
      window.openTradeCount = 0;
      window.lossStreakCount = 0;
      window.countgoal = 1;
      window.reached = false;
      window.up = false;
      window.dummy = true;
      window.isGoToNext = false;
      window.tradeWining = {};
    });

    page.on("console", async (msg) => {
      const type = msg.type();
      if (type === "log") {
        const args = await Promise.all(
          msg.args().map((arg) => arg.jsonValue())
        );
        let formattedArgs = args.map((arg) =>
          typeof arg === "object" ? JSON.stringify(arg) : arg
        );

        if (
          formattedArgs.some((arg) => {
            if (typeof arg === "string") {
              try {
                const obj = JSON.parse(arg);
                return (
                  obj &&
                  obj.data &&
                  obj.data.deals &&
                  Array.isArray(obj.data.deals)
                );
              } catch (error) {
                return false;
              }
            }
            return false;
          })
        ) {
          let output = [...formattedArgs];
          output = JSON.parse(output[0]);

          console.log(`Your profit is ${output.data.profit}`);
          await page.evaluate((output) => {
            window.isGoToNext = true;
            window.tradeWining = output;
            openTradeCount = 0;
          }, output);
        }
      }
    });

    await findHighestYieldAssetAndTrade();
  } catch (error) {
    console.error("An error occurred:", error);
  }
}

// Find the highest yield asset and start the trading loop
async function findHighestYieldAssetAndTrade() {
  let highestRowJson = { name: null };
  await page.click(
    ".trading-chart_assets .asset-select button.asset-select_button"
  );

  highestRowJson = await page.evaluate((highestRowJson) => {
    const rows = document.querySelectorAll(".assets-table__item");
    let maxRev = -Infinity;
    let maxRevRow = null;

    rows.forEach((row) => {
      const revFrom1Min = parseFloat(
        row.querySelector(".assets-table__percent.payoutOne span").textContent
      );
      if (revFrom1Min > maxRev) {
        maxRev = revFrom1Min;
        maxRevRow = row;
      }
    });

    if (maxRevRow) {
      maxRevRow.querySelector(".assets-table__name").click();
      let name = maxRevRow.querySelector(
        ".assets-table__name span"
      ).textContent;
      let change = maxRevRow.querySelector(
        ".assets-table__change span"
      ).textContent;
      let revFrom1Min = parseFloat(
        maxRevRow.querySelector(".assets-table__percent.payoutOne span")
          .textContent
      );

      highestRowJson = { name, change, "Rev. from 1 min": revFrom1Min };
      return highestRowJson;
    }

    return false;
  }, highestRowJson);

  if (highestRowJson === false) {
    console.log(
      "Could not find the highest Rev. from 1 min. Please run your script again"
    );
    return;
  }

  console.log("Detected the highest Rev. from 1 min", highestRowJson);

  highestRowJson.name = highestRowJson.name
    ?.replace("/", "")
    .replace(" (OTC)", "_otc");
  if (highestRowJson.name === "USDBRL_otc") highestRowJson.name = "BRLUSD_otc";

  let wsSendData = ["orders/open", { asset: highestRowJson.name, ...option }];
  await sleep(1000);

  await startTradeLoop(wsSendData);
}

// Function to start the trading loop
async function startTradeLoop(wsSendData) {
  await page.evaluate(
    async ({ wsSendData, option }) => {
      console.log("Received Array ", wsSendData);

      async function tradeLoop(wsObj, wsSendData, option) {
        while (true) {
          let randomNumber = Math.random();
          if (!up) {
            wsSendData[1].action = "call";
            up = true;
          } else {
            wsSendData[1].action = "put";
            up = false;
          }
          if (reached) {
            wsSendData[1].amount = 100;
            reached = false;
          } else {
            wsSendData[1].amount = 1;
          }

          let dataSend = "42" + JSON.stringify(wsSendData);
          wsObj.ws.send(dataSend);
          openTradeCount = 1;
          window.runcode({
            state: "runcode",
            data: "\n\n\nTrade placed successfully. Waiting for result...",
          });
          openTradeCount = 1;
          while (openTradeCount === 1 && !window.isGoToNext) {
            await new Promise((resolve) => setTimeout(resolve, 0));
          }

          let winingTrade = window.tradeWining || {};
          window.isGoToNext = false;
          if (winingTrade.data.profit - option.amount < 0) {
            lossStreakCount++;
            if (lossStreakCount === 11) {
              reached = true;
              lossStreakCount = 0;
            } else {
              reached = false;
              option.amount = 1;
            }
          } else {
            reached = false;
            lossStreakCount = 0;
            option.amount = 1;
          }
        }
      }

      for (let key in trackedWebSockets) {
        let wsObj = trackedWebSockets[key];

        // Store the WebSocket object for reconnection handling
        if (key === "main") {
          globalThis.wsObj = wsObj;
        }
        // Forcefully disconnect WebSocket after 30 seconds
        setTimeout(() => {
          console.log("Forcing WebSocket to close after 30 seconds");
          wsObj.ws.close();
        }, 30000);

        wsObj.ws.onclose = async () => {
          console.log(`WebSocket ${key} closed`);
          await reconnect(); // Reconnect WebSocket on close
        };

        if (option.loopIt === "Infinity") {
          await tradeLoop(wsObj, wsSendData, option).catch((err) =>
            window.runcode({
              state: "runcode",
              data: "\nError in tradeLoop:" + err,
            })
          );
        } else {
          for (let index = 0; index < option.loopIt; index++) {
            wsObj.ws.send(wsSendData);

            window.runcode({
              state: "runcode",
              data: "\n\n\nTrade placed successfully. Waiting for result...",
            });

            while (!window.isGoToNext) {
              await new Promise((resolve) => setTimeout(resolve, 1000));
            }
            window.isGoToNext = false;
          }
        }
      }
    },
    { wsSendData, option }
  );
}

// Function to handle WebSocket reconnection
async function reconnect() {
  console.log("Attempting to reconnect...");
  setTimeout(async () => {
    try {
      if (globalThis.wsObj) {
        globalThis.wsObj.ws = new WebSocket(globalThis.wsObj.ws.url);

        globalThis.wsObj.ws.onopen = async () => {
          console.log("Reconnected successfully");
          await findHighestYieldAssetAndTrade();
        };

        globalThis.wsObj.ws.onerror = (error) => {
          console.error("Reconnect attempt failed:", error);
          reconnect();
        };

        globalThis.wsObj.ws.onclose = async () => {
          console.log("WebSocket closed again");
          await reconnect();
        };
      }
    } catch (error) {
      console.error("Reconnect attempt failed:", error);
      reconnect();
    }
  }, 5000); // Wait 5 seconds before reconnecting
}

// Function to pause execution for a given time
const sleep = (milliseconds) => {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
};

// Start the script
runAndLoggedIn();

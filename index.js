const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");
const { loginAndTrade } = require("./loginAndTrade");

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
exports.openTradeCount = openTradeCount;
let lossStreakCount = 0;
let countgoal = 1;
let reached = false;
let up = false;
let dummy = true;
let browser;
let page;
exports.page = page;
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

// Find the highest yield asset and start the trading loop
async function findHighestYieldAssetAndTrade() {
  let highestRowJson = { name: null };
  await page.click(
    ".trading-chart__assets .asset-select button.asset-select__button"
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

  await page.evaluate(
    async ({ wsSendData, option }) => {
      console.log("Received Array ", wsSendData);

      async function tradeLoop(wsObj, wsSendData, option) {
        // Forcefully disconnect WebSocket after 30 seconds
        setTimeout(() => {
          console.log("Forcing WebSocket to close after 30 seconds");
          window.runcode({
            state: "runcode",
            data: "\n\n\nForcing WebSocket to close after 30 seconds",
          });
          wsObj.ws.close();
        }, 30000);

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

        wsObj.ws.onclose = async () => {
          console.log(`WebSocket ${key} closed`);
          window.runcode({
            state: "runcode",
            data: `\n\n\nWebSocket ${key} closed`,
          });
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
exports.findHighestYieldAssetAndTrade = findHighestYieldAssetAndTrade;

// Function to handle WebSocket reconnection
async function reconnect() {
  console.log("Attempting to reconnect...");
  window.runcode({
    state: "runcode",
    data: "\n\n\nAttempting to reconnect...",
  });
  setTimeout(async () => {
    try {
      if (globalThis.wsObj) {
        globalThis.wsObj.ws = new WebSocket(globalThis.wsObj.ws.url);

        globalThis.wsObj.ws.onopen = async () => {
          console.log("Reconnected successfully");
          window.runcode({
            state: "runcode",
            data: "\n\n\nReconnected successfully",
          });

          // Restart the trading loop
          await page.evaluate(
            async ({ wsSendData, option }) => {
              async function tradeLoop(wsObj, wsSendData, option) {
                setTimeout(() => {
                  console.log("Forcing WebSocket to close after 30 seconds");
                  window.runcode({
                    state: "runcode",
                    data: "\n\n\nForcing WebSocket to close after 30 seconds",
                  });
                  wsObj.ws.close();
                }, 30000);

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

              await tradeLoop(globalThis.wsObj, wsSendData, option).catch(
                (err) =>
                  window.runcode({
                    state: "runcode",
                    data: "\nError in tradeLoop:" + err,
                  })
              );
            },
            { wsSendData: globalThis.wsObj.wsSendData, option }
          );
        };

        globalThis.wsObj.ws.onerror = (error) => {
          console.error("Reconnect attempt failed:", error);
          window.runcode({
            state: "runcode",
            data: "\n\n\nReconnect attempt failed: " + error,
          });
          reconnect();
        };

        globalThis.wsObj.ws.onclose = async () => {
          console.log("WebSocket closed again");
          window.runcode({
            state: "runcode",
            data: `\n\n\nWebSocket closed again`,
          });
          await reconnect();
        };

        setupWebSocketListeners(globalThis.wsObj.ws);
      }
    } catch (error) {
      console.error("Reconnect attempt failed:", error);
      window.runcode({
        state: "runcode",
        data: "\n\n\nReconnect attempt failed: " + error,
      });
      reconnect();
    }
  }, 5000); // Wait 5 seconds before reconnecting
}

// Set up WebSocket listeners
function setupWebSocketListeners(ws) {
  ws.onopen = async () => {
    console.log("WebSocket connection opened");
    window.runcode({
      state: "runcode",
      data: "\n\n\nWebSocket connection opened",
    });
  };

  ws.onmessage = (message) => {
    console.log("WebSocket message received:", message.data);
    window.runcode({
      state: "runcode",
      data: "\n\n\nWebSocket message received: " + message.data,
    });
  };

  ws.onclose = async () => {
    console.log("WebSocket connection closed");
    window.runcode({
      state: "runcode",
      data: "\n\n\nWebSocket connection closed",
    });
    await reconnect();
  };

  ws.onerror = (error) => {
    console.error("WebSocket error:", error);
    window.runcode({
      state: "runcode",
      data: "\n\n\nWebSocket error: " + error,
    });
  };
}

// Function to pause execution for a given time
const sleep = (milliseconds) => {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
};

// Start the script
runAndLoggedIn();

const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");

let option = {
  amount: 500,
  time: 5,
  action: "call",
  isDemo: 1,
  tournamentId: 0,
  requestId: 1713314207,
  optionType: 100,
  loopIt: "Infinity",
};

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

    // Run the trading thing from here:
    await page.exposeFunction("runcode", (msg) => {
      if (msg.state == "runcode") {
        console.log(msg.data);
      }

      // if (msg.state == "message") {
      //   try {
      //     let received = JSON.parse(msg.msg.replace(/^\d+-/, ""));
      //     if(received[0] == "quotes/stream"){
      //     } else {
      //       console.log(received);
      //     }
      //   } catch (e) {
      //   }
      // }
    });

    await page.waitForSelector(
      ".trading-chart__assets .asset-select button.asset-select__button"
    );

    page.on("console", async (msg) => {
      const type = msg.type();
      if (type == "log") {
        const args = await Promise.all(
          msg.args().map((arg) => arg.jsonValue())
        );

        let formattedArgs = args.map((arg) =>
          typeof arg === "object" ? JSON.stringify(arg) : arg
        );

        // Check if the object has properties related to trade information
        if (
          formattedArgs.some((arg) => {
            if (typeof arg === "string") {
              try {
                const obj = JSON.parse(arg);
                let isIt =
                  obj &&
                  obj.data &&
                  obj.data.deals &&
                  Array.isArray(obj.data.deals);

                return isIt;
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
          }, output);
        }
      }
    });

    var highestRowJson = { name: null };
    await page.click(
      ".trading-chart__assets .asset-select button.asset-select__button"
    );

    highestRowJson = await page.evaluate((highestRowJson) => {
      // Select all rows
      const rows = document.querySelectorAll(".assets-table__item");
      let maxRev = -Infinity;
      let maxRevRow = null;

      // Loop through each row to find the one with the highest "Rev. from 1 min" value
      rows.forEach((row) => {
        const revFrom1Min = parseFloat(
          row.querySelector(".assets-table__percent.payoutOne span").textContent
        );
        if (revFrom1Min > maxRev) {
          maxRev = revFrom1Min;
          maxRevRow = row;
        }
      });

      // Click on the row with the highest "Rev. from 1 min" value
      if (maxRevRow) {
        let maxRevRowToClick = maxRevRow.querySelector(".assets-table__name");
        maxRevRowToClick.click();

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

    if (highestRowJson == false) {
      console.log(
        "Could not find the highest Rev. from 1 min. Please run your script again"
      );
      return;
    }

    console.log("Detected the highest Rev. from 1 min", highestRowJson);

    highestRowJson.name = highestRowJson.name
      ?.replace("/", "")
      .replace(" (OTC)", "_otc");

    if (highestRowJson.name == "USDBRL_otc") highestRowJson.name = "BRLUSD_otc";

    let wsSendData = [
      "orders/open",
      {
        asset: highestRowJson.name,
        ...option,
      },
    ];

    await sleep(1000);

    await page.evaluate(
      async ({ wsSendData, option }) => {
        console.log("Received Array ", wsSendData);
        for (let key in trackedWebSockets) {
          let wsObj = trackedWebSockets[key];

          if (option.loopIt == "Infinity") {
            for (;;) {
              let min = 1;
              let max = 10;
              wsSendData[1].amount =
                Math.floor(Math.random() * (max - min + 1)) + min;

              min = 5;
              wsSendData[1].time =
                Math.floor(Math.random() * (max - min + 1)) + min;

              let randomNumber = Math.random();
              if (randomNumber > 0.5) {
                wsSendData[1].action = "call";
              } else {
                wsSendData[1].action = "put";
              }

              let dataSend = "42" + JSON.stringify(wsSendData);
              wsObj.ws.send(dataSend);

              window.runcode({
                state: "runcode",
                data: "\n\n\nTrade placed successfully. Waiting for result...",
              });

              // Wait until isGoToNext is true
              while (!window.isGoToNext) {
                await new Promise((resolve) => setTimeout(resolve, 1000));
              }

              let winingTrade = window.tradeWining || {};

              window.runcode({
                state: "runcode",
                data: winingTrade,
              });

              window.isGoToNext = false;
            }
          } else {
            for (let index = 0; index < option.loopIt; index++) {
              wsObj.ws.send(wsSendData);

              window.runcode({
                state: "runcode",
                data: "\n\n\nTrade placed successfully. Waiting for result...",
              });

              // Wait until isGoToNext is true
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
  } catch (error) {
    console.error("An error occurred:", error);
  } finally {
    // await browser.close();
  }
}

runAndLoggedIn();

const sleep = (milliseconds) => {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
};

import undetected_chromedriver as uc
import time
import json
import websocket
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from websocket import create_connection, WebSocketTimeoutException, WebSocketConnectionClosedException

# Trading options
option = {
    "amount": 1,
    "time": 5,  # Updated to 5 as per your correct parameters
    "action": "call",
    "isDemo": 1,
    "tournamentId": 0,
    "requestId": 1716704230,  # Updated requestId to 1716704230
    "optionType": 100,
    "loopIt": "Infinity",
}

open_trade_count = 0
loss_streak_count = 0
countgoal = 1
reached = False
up = False

# Set up undetected_chromedriver
driver = uc.Chrome()

def initialize_browser():
    driver.get("https://qxbroker.com/en/demo-trade")
    time.sleep(5)  # Wait for page to load

    # Load cookies
    with open('Cookies.json', 'r') as f:
        cookies = json.load(f)
        for cookie in cookies:
            driver.add_cookie(cookie)

    driver.refresh()
    time.sleep(5)  # Wait for page to load after refreshing

def get_cookies():
    cookies = driver.get_cookies()
    cookie_header = "; ".join([f"{cookie['name']}={cookie['value']}" for cookie in cookies])
    return cookies, cookie_header

def find_highest_yield_asset():
    try:
        WebDriverWait(driver, 20).until(EC.presence_of_element_located((By.CSS_SELECTOR, ".trading-chart__assets .asset-select button.asset-select__button")))
        driver.find_element(By.CSS_SELECTOR, ".trading-chart__assets .asset-select button.asset-select__button").click()
        time.sleep(1)

        highest_row_json = driver.execute_script('''
            const rows = document.querySelectorAll(".assets-table__item");
            let maxRev = -Infinity;
            let maxRevRow = null;

            rows.forEach((row) => {
                const revFrom1Min = parseFloat(row.querySelector(".assets-table__percent.payoutOne span").textContent);
                if (revFrom1Min > maxRev) {
                    maxRev = revFrom1Min;
                    maxRevRow = row;
                }
            });

            if (maxRevRow) {
                maxRevRow.querySelector(".assets-table__name").click();
                let name = maxRevRow.querySelector(".assets-table__name span").textContent;
                let change = maxRevRow.querySelector(".assets-table__change span").textContent;
                let revFrom1Min = parseFloat(maxRevRow.querySelector(".assets-table__percent.payoutOne span").textContent);

                return {name, change, "Rev. from 1 min": revFrom1Min};
            }

            return false;
        ''')

        if highest_row_json:
            print("Detected the highest Rev. from 1 min", highest_row_json)
            highest_row_json['name'] = highest_row_json['name'].replace("/", "").replace(" (OTC)", "_otc")
            if highest_row_json['name'] == "USDBRL_otc":
                highest_row_json['name'] = "BRLUSD_otc"
            return highest_row_json
        else:
            print("Could not find the highest Rev. from 1 min. Please run your script again")
            return None

    except Exception as e:
        print(f"An error occurred: {e}")
        return None

def place_trade(ws, asset):
    trade_data = ["orders/open", {"asset": asset['name'], **option}]
    data_send = "42" + json.dumps(trade_data)
    print(f"Sending trade data: {data_send}")  # Debugging statement
    ws.send(data_send)
    print("Trade placed:", trade_data)

def handle_message(ws, raw_message):
    global open_trade_count, loss_streak_count, reached, up
    print(f"Raw message received: {raw_message}")  # Debugging statement

    # Extract the payload from the received message
    if raw_message.startswith("42"):
        try:
            message = json.loads(raw_message[2:])  # Skip the first two characters which indicate the message type
            print(f"Parsed message: {message}")  # Debugging statement
        except json.JSONDecodeError as e:
            print(f"JSON decode error: {e}")
            return
    elif raw_message.startswith("0") or raw_message.startswith("40"):
        # Handle ping/pong and connection messages
        if raw_message.startswith("0"):
            ws.send("40")
        print(f"Non-trade message received: {raw_message}")
        return
    else:
        print(f"Non-trade message received: {raw_message}")
        return

    if isinstance(message, list) and message[0] == "orders/open":
        response_data = message[1]
        print(f"Trade response received: {response_data}")  # Debugging statement
        if "data" in response_data:
            profit = response_data["data"]["profit"]
            print(f"Profit: {profit}")  # Debugging statement
            if profit - option["amount"] < 0:
                loss_streak_count += 1
                if loss_streak_count == 11:
                    reached = True
                    loss_streak_count = 0
                else:
                    reached = False
                    option["amount"] = 1
            else:
                reached = False
                loss_streak_count = 0
                option["amount"] = 1
            open_trade_count = 0
    elif "error" in message:
        print(f"Error message received: {message}")
    else:
        print(f"Unrecognized message received: {message}")

def trade_loop(ws, asset):
    while True:
        try:
            place_trade(ws, asset)
            open_trade_count = 1

            while open_trade_count == 1:
                raw_message = ws.recv()
                handle_message(ws, raw_message)
        except WebSocketTimeoutException:
            print("WebSocket timeout, reconnecting...")
            ws.close()
            ws = create_websocket_connection()
        except WebSocketConnectionClosedException:
            print("WebSocket connection closed, reconnecting...")
            ws.close()
            ws = create_websocket_connection()
        except Exception as e:
            print(f"An error occurred: {e}")

def create_websocket_connection():
    cookies, cookie_header = get_cookies()
    headers = {
        "Cookie": cookie_header,
        "User-Agent": driver.execute_script("return navigator.userAgent;")
    }
    ws = websocket.WebSocket()
    print("Connecting to WebSocket...")  # Debugging statement
    ws.connect("wss://ws2.qxbroker.com/socket.io/?EIO=3&transport=websocket", header=headers)
    print("WebSocket connected")  # Debugging statement
    return ws

if __name__ == "__main__":
    initialize_browser()
    asset = find_highest_yield_asset()
    if not asset:
        print("Could not find the highest yield asset. Please try again.")
    else:
        print("Trading on asset:", asset)
        ws = create_websocket_connection()
        trade_loop(ws, asset)

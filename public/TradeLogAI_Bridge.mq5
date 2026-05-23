//+------------------------------------------------------------------+
//| TradeLog AI Bridge EA                                            |
//| Sends closed MT5 trade data to TradeLog AI as JSON.              |
//+------------------------------------------------------------------+
#property strict
#property version "1.01"

input string InpApiKey = "PASTE_YOUR_TRADELOG_AI_API_KEY";
input string InpApiUrl = "https://tradelog-ai-one.vercel.app/api/mt5";
input bool InpSendOnlyClosedDeals = true;

datetime lastScanTime = 0;

int OnInit()
{
   if(InpApiUrl != "https://tradelog-ai-one.vercel.app/api/mt5")
      Print("TradeLog AI warning: InpApiUrl should be https://tradelog-ai-one.vercel.app/api/mt5");

   Print("TradeLog AI Bridge started");
   Print("Allow this WebRequest URL in MT5 options: https://tradelog-ai-one.vercel.app");
   Print("POST endpoint: ", InpApiUrl);

   lastScanTime = TimeCurrent() - 86400;
   return(INIT_SUCCEEDED);
}

void OnTick()
{
   datetime nowTime = TimeCurrent();
   if(!HistorySelect(lastScanTime, nowTime))
      return;

   int total = HistoryDealsTotal();
   for(int i = 0; i < total; i++)
   {
      ulong ticket = HistoryDealGetTicket(i);
      if(ticket == 0)
         continue;

      long entryType = HistoryDealGetInteger(ticket, DEAL_ENTRY);
      if(InpSendOnlyClosedDeals && entryType != DEAL_ENTRY_OUT)
         continue;

      string symbol = HistoryDealGetString(ticket, DEAL_SYMBOL);
      long dealType = HistoryDealGetInteger(ticket, DEAL_TYPE);
      double volume = HistoryDealGetDouble(ticket, DEAL_VOLUME);
      double price = HistoryDealGetDouble(ticket, DEAL_PRICE);
      double profit = HistoryDealGetDouble(ticket, DEAL_PROFIT);
      datetime dealTime = (datetime)HistoryDealGetInteger(ticket, DEAL_TIME);

      string direction = (dealType == DEAL_TYPE_SELL || dealType == DEAL_TYPE_SELL_CANCELED) ? "SELL" : "BUY";
      string json = "{";
      json += "\"api_key\":\"" + JsonEscape(InpApiKey) + "\",";
      json += "\"ticket\":\"" + (string)ticket + "\",";
      json += "\"symbol\":\"" + JsonEscape(symbol) + "\",";
      json += "\"direction\":\"" + direction + "\",";
      json += "\"entry_price\":" + DoubleToString(price, _Digits) + ",";
      json += "\"exit_price\":" + DoubleToString(price, _Digits) + ",";
      json += "\"volume\":" + DoubleToString(volume, 2) + ",";
      json += "\"profit\":" + DoubleToString(profit, 2) + ",";
      json += "\"time\":\"" + TimeToString(dealTime, TIME_DATE | TIME_SECONDS) + "\"";
      json += "}";

      SendTrade(json);
   }

   lastScanTime = nowTime;
}

void SendTrade(string json)
{
   if(InpApiKey == "" || InpApiKey == "PASTE_YOUR_TRADELOG_AI_API_KEY")
   {
      Print("TradeLog AI sync skipped: set InpApiKey first.");
      return;
   }

   char data[];
   char result[];
   string responseHeaders = "";
   string headers = "Content-Type: application/json\r\nAccept: application/json\r\n";

   int bytes = StringToCharArray(json, data, 0, WHOLE_ARRAY, CP_UTF8);
   if(bytes > 0)
      ArrayResize(data, bytes - 1);

   ResetLastError();
   int status = WebRequest("POST", InpApiUrl, headers, 10000, data, result, responseHeaders);
   string response = CharArrayToString(result, 0, -1, CP_UTF8);

   if(status == -1)
   {
      Print("TradeLog AI WebRequest failed. Error: ", GetLastError());
      Print("Check MT5 Options > Expert Advisors > Allow WebRequest for: https://tradelog-ai-one.vercel.app");
      return;
   }

   if(StringFind(response, "<!DOCTYPE") >= 0 || StringFind(response, "<html") >= 0)
   {
      Print("TradeLog AI received HTML instead of JSON. Check InpApiUrl: ", InpApiUrl);
      Print("Expected: https://tradelog-ai-one.vercel.app/api/mt5");
      Print("HTTP status: ", status, " response: ", response);
      return;
   }

   Print("TradeLog AI sync HTTP ", status, " response: ", response);
}

string JsonEscape(string value)
{
   StringReplace(value, "\\", "\\\\");
   StringReplace(value, "\"", "\\\"");
   StringReplace(value, "\r", "\\r");
   StringReplace(value, "\n", "\\n");
   return value;
}

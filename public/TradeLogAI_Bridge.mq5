//+------------------------------------------------------------------+
//| TradeLog AI Bridge EA                                            |
//| Sends closed MT5 trade data to TradeLog AI.                      |
//+------------------------------------------------------------------+
#property strict

input string ApiKey = "PASTE_YOUR_TRADELOG_AI_API_KEY";
input string EndpointUrl = "https://tradelog-ai-one.vercel.app/api/mt5";
input bool SendOnlyClosedDeals = true;

datetime lastScanTime = 0;

int OnInit()
{
   Print("TradeLog AI Bridge started. Add https://tradelog-ai-one.vercel.app to WebRequest allowed URLs.");
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
      if(SendOnlyClosedDeals && entryType != DEAL_ENTRY_OUT)
         continue;

      string symbol = HistoryDealGetString(ticket, DEAL_SYMBOL);
      long dealType = HistoryDealGetInteger(ticket, DEAL_TYPE);
      double volume = HistoryDealGetDouble(ticket, DEAL_VOLUME);
      double price = HistoryDealGetDouble(ticket, DEAL_PRICE);
      double profit = HistoryDealGetDouble(ticket, DEAL_PROFIT);
      datetime dealTime = (datetime)HistoryDealGetInteger(ticket, DEAL_TIME);

      string direction = (dealType == DEAL_TYPE_SELL || dealType == DEAL_TYPE_SELL_CANCELED) ? "SELL" : "BUY";
      string json = "{";
      json += "\"api_key\":\"" + JsonEscape(ApiKey) + "\",";
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
   char data[];
   char result[];
   string headers = "Content-Type: application/json\r\n";
   StringToCharArray(json, data, 0, WHOLE_ARRAY, CP_UTF8);

   string resultHeaders;
   int status = WebRequest("POST", EndpointUrl, headers, 10000, data, result, resultHeaders);
   if(status == -1)
   {
      Print("TradeLog AI WebRequest failed. Error: ", GetLastError());
      return;
   }

   Print("TradeLog AI sync status: ", status, " response: ", CharArrayToString(result));
}

string JsonEscape(string value)
{
   StringReplace(value, "\\", "\\\\");
   StringReplace(value, "\"", "\\\"");
   return value;
}

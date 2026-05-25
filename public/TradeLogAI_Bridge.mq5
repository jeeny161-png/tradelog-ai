//+------------------------------------------------------------------+
//| TradeLog AI Bridge EA                                            |
//| Sends closed MT5 deal data to TradeLog AI as JSON.               |
//+------------------------------------------------------------------+
#property strict
#property version "1.03"

input string InpApiKey = "PASTE_YOUR_TRADELOG_AI_API_KEY";
input string InpApiUrl = "https://tradelog-ai-one.vercel.app/api/mt5";

ulong sent_tickets[];

int OnInit()
{
   if(InpApiUrl != "https://tradelog-ai-one.vercel.app/api/mt5")
      Print("TradeLog AI warning: InpApiUrl should be https://tradelog-ai-one.vercel.app/api/mt5");

   ArrayResize(sent_tickets, 0);
   Print("TradeLog AI Bridge v1.03 started");
   Print("Allow this WebRequest URL in MT5 options: https://tradelog-ai-one.vercel.app");
   Print("POST endpoint: ", InpApiUrl);
   return(INIT_SUCCEEDED);
}

void OnTradeTransaction(const MqlTradeTransaction& trans, const MqlTradeRequest& request, const MqlTradeResult& result)
{
   if(trans.type != TRADE_TRANSACTION_DEAL_ADD)
      return;

   ulong ticket = trans.deal;
   if(ticket == 0 || TicketWasSent(ticket))
      return;

   if(!HistoryDealSelect(ticket))
      return;

   long entryType = HistoryDealGetInteger(ticket, DEAL_ENTRY);
   if(entryType != DEAL_ENTRY_OUT)
      return;

   string json = BuildDealJson(ticket);
   if(SendTrade(json))
      MarkTicketSent(ticket);
}

string BuildDealJson(ulong ticket)
{
   // --- Closing deal fields ---
   string symbol       = HistoryDealGetString(ticket, DEAL_SYMBOL);
   long   closeDealType= HistoryDealGetInteger(ticket, DEAL_TYPE);  // Type of the CLOSING deal
   double volume       = HistoryDealGetDouble(ticket, DEAL_VOLUME);
   double exitPrice    = HistoryDealGetDouble(ticket, DEAL_PRICE);  // Execution price of closing
   double profit       = HistoryDealGetDouble(ticket, DEAL_PROFIT);
   double swap         = HistoryDealGetDouble(ticket, DEAL_SWAP);
   double commission   = HistoryDealGetDouble(ticket, DEAL_COMMISSION);
   datetime dealTime   = (datetime)HistoryDealGetInteger(ticket, DEAL_TIME);
   long   positionId   = HistoryDealGetInteger(ticket, DEAL_POSITION_ID);

   // --- Find the ENTRY deal for this position to get correct direction & entry price ---
   // Direction MUST come from the entry deal, NOT the closing deal.
   //   Entry DEAL_TYPE_BUY  (0) -> Long  position -> direction "L"
   //   Entry DEAL_TYPE_SELL (1) -> Short position -> direction "S"
   double entryPrice    = exitPrice;   // fallback: use close price if entry not found
   long   entryDealType = -1;

   if(HistorySelectByPosition(positionId))
   {
      int n = HistoryDealsTotal();
      for(int i = 0; i < n; i++)
      {
         ulong dealTicket = HistoryDealGetTicket(i);
         if(HistoryDealGetInteger(dealTicket, DEAL_ENTRY) == DEAL_ENTRY_IN)
         {
            entryDealType = HistoryDealGetInteger(dealTicket, DEAL_TYPE);
            entryPrice    = HistoryDealGetDouble(dealTicket, DEAL_PRICE);
            break;
         }
      }
   }

   // --- Direction from ENTRY deal type ---
   string direction;
   if(entryDealType == DEAL_TYPE_BUY)
      direction = "L";                  // Long:  entry was Buy
   else if(entryDealType == DEAL_TYPE_SELL)
      direction = "S";                  // Short: entry was Sell
   else
   {
      // Fallback (entry deal not found): invert the CLOSING deal type.
      // Closing SELL = position was Long; Closing BUY = position was Short.
      direction = (closeDealType == DEAL_TYPE_BUY) ? "S" : "L";
      Print("TradeLog AI: entry deal not found for position ", positionId,
            ", using fallback direction from close deal (", direction, ")");
   }

   Print("TradeLog AI: ticket=", ticket, " posId=", positionId,
         " entryType=", entryDealType, " closeType=", closeDealType,
         " direction=", direction, " entry=", entryPrice, " exit=", exitPrice);

   string json = "{";
   json += "\"api_key\":\"" + JsonEscape(InpApiKey) + "\",";
   json += "\"ticket\":\"" + (string)ticket + "\",";
   json += "\"deal_entry\":\"DEAL_ENTRY_OUT\",";
   json += "\"symbol\":\"" + JsonEscape(symbol) + "\",";
   json += "\"direction\":\"" + direction + "\",";
   json += "\"entry_price\":" + DoubleToString(entryPrice, _Digits) + ",";
   json += "\"exit_price\":" + DoubleToString(exitPrice, _Digits) + ",";
   json += "\"volume\":" + DoubleToString(volume, 2) + ",";
   json += "\"profit\":" + DoubleToString(profit, 2) + ",";
   json += "\"swap\":" + DoubleToString(swap, 2) + ",";
   json += "\"commission\":" + DoubleToString(commission, 2) + ",";
   json += "\"time\":\"" + TimeToString(dealTime, TIME_DATE | TIME_SECONDS) + "\"";
   json += "}";
   return json;
}

bool SendTrade(string json)
{
   if(InpApiKey == "" || InpApiKey == "PASTE_YOUR_TRADELOG_AI_API_KEY")
   {
      Print("TradeLog AI sync skipped: set InpApiKey first.");
      return false;
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
      return false;
   }

   if(StringFind(response, "<!DOCTYPE") >= 0 || StringFind(response, "<html") >= 0)
   {
      Print("TradeLog AI received HTML instead of JSON. Check InpApiUrl: ", InpApiUrl);
      Print("Expected: https://tradelog-ai-one.vercel.app/api/mt5");
      Print("HTTP status: ", status, " response: ", response);
      return false;
   }

   Print("TradeLog AI sync HTTP ", status, " response: ", response);
   return status >= 200 && status < 300;
}

bool TicketWasSent(ulong ticket)
{
   for(int i = 0; i < ArraySize(sent_tickets); i++)
   {
      if(sent_tickets[i] == ticket)
         return true;
   }
   return false;
}

void MarkTicketSent(ulong ticket)
{
   int size = ArraySize(sent_tickets);
   ArrayResize(sent_tickets, size + 1);
   sent_tickets[size] = ticket;
}

string JsonEscape(string value)
{
   StringReplace(value, "\\", "\\\\");
   StringReplace(value, "\"", "\\\"");
   StringReplace(value, "\r", "\\r");
   StringReplace(value, "\n", "\\n");
   return value;
}

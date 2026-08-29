// ============================================================================
// Sector classification. GICS's eleven sectors plus two practical buckets
// (ETF / fund, and Unassigned for anything we don't recognise). The built-in
// map covers the tickers a retail wheel trader is most likely to hold; the
// user can override any ticker on the Allocation page, and the override wins.
// ============================================================================

export const SECTORS = [
  "Information Technology",
  "Communication Services",
  "Consumer Discretionary",
  "Consumer Staples",
  "Financials",
  "Health Care",
  "Industrials",
  "Energy",
  "Materials",
  "Real Estate",
  "Utilities",
  "ETF / Fund",
] as const;
export type Sector = (typeof SECTORS)[number];
export const UNASSIGNED = "Unassigned";

const group = (sector: string, tickers: string): [string, string][] =>
  tickers
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => [t, sector]);

export const BUILTIN_SECTORS: Record<string, string> = Object.fromEntries([
  ...group(
    "Information Technology",
    `AAPL MSFT NVDA AMD INTC AVGO QCOM MU TSM ORCL CRM ADBE CSCO IBM PLTR SNOW NET CRWD PANW
     ZS DDOG MDB OKTA SHOP SQ PYPL AFRM HOOD SOFI COIN UPST SMCI ARM MRVL ON TXN ADI LRCX AMAT
     KLAC ASML DELL HPQ HPE NOW WDAY TEAM U PATH AI SOUN BBAI IONQ RGTI QUBT ONDS LUNR ASTS
     RKLB APP ANET FTNT ACN INFY WIT STNE NU GRAB SE`
  ),
  ...group(
    "Communication Services",
    `GOOGL GOOG META NFLX DIS T VZ TMUS CMCSA CHTR WBD PARA ROKU SPOT SNAP PINS RDDT TTD EA
     TTWO RBLX MTCH BIDU LYFT UBER BILI IQ`
  ),
  ...group(
    "Consumer Discretionary",
    `AMZN TSLA HD LOW MCD SBUX NKE TGT BABA JD PDD F GM RIVN LCID NIO XPEV LI CCL RCL NCLH
     MAR HLT ABNB BKNG EXPE CHWY ETSY EBAY W GME AMC DKNG PTON LULU TJX ROST DPZ CMG YUM DASH
     CVNA KMX`
  ),
  ...group(
    "Consumer Staples",
    `WMT COST PG KO PEP PM MO KHC GIS K CL KMB MDLZ HSY STZ TAP BUD KR ACI DG DLTR CELH KVUE
     EL CPB SJM HRL TSN`
  ),
  ...group(
    "Financials",
    `JPM BAC WFC C GS MS SCHW BLK BX KKR APO AXP V MA COF DFS SYF ALLY USB PNC TFC KEY RF HBAN
     FITB CFG MTB BK STT ICE CME NDAQ SPGI MCO MSCI MET PRU AIG AFL PGR ALL TRV CB MMC AON
     BRK.B BRK.A LC OPEN RKT UWMC`
  ),
  ...group(
    "Health Care",
    `JNJ PFE MRK ABBV LLY BMY AMGN GILD REGN VRTX MRNA BNTX NVAX UNH CVS CI HUM ELV CNC MOH
     ABT TMO DHR MDT SYK BSX ISRG ZBH EW DXCM HIMS TDOC CLOV OSCR WBA RXRX CRSP NTLA EDIT
     BEAM SAVA`
  ),
  ...group(
    "Industrials",
    `BA GE GEV RTX LMT NOC GD LHX HON CAT DE MMM UPS FDX UNP CSX NSC WM RSG EMR ETN PH ROK
     ITW CARR OTIS JCI PLUG FCEL BLDP JOBY ACHR HTZ AAL DAL UAL LUV JBLU ALK ALGT SAVE`
  ),
  ...group(
    "Energy",
    `XOM CVX COP OXY SLB HAL BKR EOG DVN MPC VLO PSX KMI WMB OKE ET EPD MPLX FANG APA HES
     CTRA BTU ARCH`
  ),
  ...group(
    "Materials",
    `LIN APD SHW ECL DD DOW NEM FCX NUE STLD X AA CENX MP ALB LAC SQM MOS CF CTVA VALE RIO
     BHP GOLD AEM CLF`
  ),
  ...group(
    "Real Estate",
    `PLD AMT CCI EQIX SPG O VICI WELL PSA DLR AVB EQR MAA ESS INVH EXR CUBE ARE BXP KIM REG
     FRT VNO SLG MPW AGNC NLY STWD`
  ),
  ...group(
    "Utilities",
    `NEE DUK SO D AEP EXC SRE XEL ED PEG WEC ES EIX ETR FE PPL AES CEG VST NRG PCG AWK`
  ),
  ...group(
    "ETF / Fund",
    `SPY VOO IVV QQQ QQQM IWM DIA VTI VT VXUS VEA VWO SCHD VYM JEPI JEPQ XYLD QYLD TQQQ SQQQ
     SOXL SOXS SPXL SPXS UPRO SDS TLT IEF SHY BND AGG HYG LQD GLD IAU SLV USO UNG XLK XLF
     XLE XLV XLI XLY XLP XLU XLB XLRE XLC SMH ARKK ARKG BITO IBIT FBTC GBTC ETHE VNQ EEM EFA
     VGT VHT VFH TNA TZA UVXY VXX SVXY DFAW DFAC DFUS DFAX DFAE AVUV AVDV AVUS AVEM`
  ),
]);

/** Resolve a ticker's sector: user override → built-in map → Unassigned. */
export function sectorOf(ticker: string, overrides?: Record<string, string>): string {
  const t = ticker.toUpperCase();
  return overrides?.[t] || BUILTIN_SECTORS[t] || UNASSIGNED;
}

/** True when the sector came from the user, not the built-in map. */
export function isSectorOverride(ticker: string, overrides?: Record<string, string>): boolean {
  return !!overrides?.[ticker.toUpperCase()];
}

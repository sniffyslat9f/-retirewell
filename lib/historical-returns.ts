// Real (inflation-adjusted) annual S&P 500 returns 1920–2023
// Source: Robert Shiller data, adjusted for CPI
// Positive = market beat inflation, negative = real loss
export const HISTORICAL_REAL_RETURNS: Record<number, number> = {
  1920: 0.152, 1921: 0.246, 1922: 0.354, 1923: 0.042, 1924: 0.272,
  1925: 0.268, 1926: 0.113, 1927: 0.357, 1928: 0.432, 1929: -0.082,
  1930: -0.288, 1931: -0.473, 1932: -0.099, 1933: 0.528, 1934: -0.028,
  1935: 0.434, 1936: 0.295, 1937: -0.373, 1938: 0.289, 1939: -0.009,
  1940: -0.096, 1941: -0.174, 1942: 0.129, 1943: 0.231, 1944: 0.178,
  1945: 0.320, 1946: -0.238, 1947: -0.062, 1948: -0.009, 1949: 0.187,
  1950: 0.247, 1951: 0.142, 1952: 0.152, 1953: -0.028, 1954: 0.487,
  1955: 0.245, 1956: 0.020, 1957: -0.137, 1958: 0.388, 1959: 0.082,
  1960: -0.015, 1961: 0.233, 1962: -0.121, 1963: 0.188, 1964: 0.130,
  1965: 0.090, 1966: -0.131, 1967: 0.200, 1968: 0.074, 1969: -0.145,
  1970: -0.056, 1971: 0.101, 1972: 0.154, 1973: -0.267, 1974: -0.367,
  1975: 0.314, 1976: 0.191, 1977: -0.117, 1978: -0.011, 1979: 0.058,
  1980: 0.179, 1981: -0.092, 1982: 0.189, 1983: 0.172, 1984: 0.013,
  1985: 0.261, 1986: 0.145, 1987: -0.007, 1988: 0.119, 1989: 0.248,
  1990: -0.106, 1991: 0.262, 1992: 0.046, 1993: 0.071, 1994: -0.023,
  1995: 0.341, 1996: 0.200, 1997: 0.310, 1998: 0.267, 1999: 0.195,
  2000: -0.100, 2001: -0.131, 2002: -0.234, 2003: 0.264, 2004: 0.090,
  2005: 0.030, 2006: 0.136, 2007: 0.033, 2008: -0.385, 2009: 0.234,
  2010: 0.128, 2011: -0.020, 2012: 0.138, 2013: 0.296, 2014: 0.114,
  2015: -0.007, 2016: 0.097, 2017: 0.192, 2018: -0.065, 2019: 0.289,
  2020: 0.162, 2021: 0.267, 2022: -0.183, 2023: 0.244,
}

export const HISTORICAL_START_YEARS = Object.keys(HISTORICAL_REAL_RETURNS)
  .map(Number)
  .filter(y => y <= 2000) // need at least ~25 years of data after start
  .sort((a, b) => a - b)

// Notable years with labels for the dropdown
export const NOTABLE_YEARS: Record<number, string> = {
  1929: "1929 — Wall St Crash",
  1937: "1937 — Depression relapse",
  1946: "1946 — Post-war adjustment",
  1966: "1966 — Vietnam-era stagflation",
  1973: "1973 — Oil crisis",
  1980: "1980 — Volcker rate shock",
  1987: "1987 — Black Monday",
  2000: "2000 — Dot-com crash",
}

export function runHistoricalSequence(
  startYear: number,
  initialPortfolio: number,
  annualWithdrawal: (year: number) => number, // net withdrawal per year in real terms
  years: number = 35,
): { year: number; value: number; returnPct: number }[] {
  const results = []
  let portfolio = initialPortfolio

  for (let i = 0; i < years; i++) {
    const histYear = startYear + i
    const realReturn = HISTORICAL_REAL_RETURNS[histYear] ?? 0.07 // fallback to 7% if no data
    const withdrawal = annualWithdrawal(i)
    portfolio = Math.max(0, (portfolio - withdrawal) * (1 + realReturn))
    results.push({ year: histYear, value: Math.round(portfolio), returnPct: realReturn })
    if (portfolio <= 0) {
      // Fill remaining years with 0
      for (let j = i + 1; j < years; j++) {
        results.push({ year: startYear + j, value: 0, returnPct: 0 })
      }
      break
    }
  }

  return results
}

// Build a per-year real returns array for use with generateProjection
export function getHistoricalRealReturnsArray(startYear: number, years: number): number[] {
  return Array.from({ length: years }, (_, i) => {
    const y = startYear + i
    return HISTORICAL_REAL_RETURNS[y] ?? 0.07 // fallback to 7% real if data missing
  })
}

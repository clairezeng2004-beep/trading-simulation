import { Stock } from './types';

export const INITIAL_STOCKS: Stock[] = [
  { ticker: 'NFLX', refPrice: 540.00, currentPrice: 540.00, prevPrice: 540.00, percentChange: 0, type: 'Equity', volatility: 0.025 },
  { ticker: 'MSFT', refPrice: 280.00, currentPrice: 280.00, prevPrice: 280.00, percentChange: 0, type: 'Equity', volatility: 0.018 },
  { ticker: 'SPX', refPrice: 4400.00, currentPrice: 4400.00, prevPrice: 4400.00, percentChange: 0, type: 'Index', volatility: 0.012 },
  { ticker: 'UST', refPrice: 135.50, currentPrice: 135.50, prevPrice: 135.50, percentChange: 0, type: 'Bond', volatility: 0.008 },
  { ticker: 'OIL', refPrice: 68.00, currentPrice: 68.00, prevPrice: 68.00, percentChange: 0, type: 'Commodity', volatility: 0.03 },
  { ticker: 'WHEAT', refPrice: 720.00, currentPrice: 720.00, prevPrice: 720.00, percentChange: 0, type: 'Commodity', volatility: 0.022 },
];

export const NEWS_TEMPLATES: Array<{ ticker: string; headline: string; impact: number }> = [
  // Initial notes
  { ticker: 'NOTE', headline: 'Investment Banks: Make sure you providing fast and competitive quotes for your clients', impact: 0 },
  { ticker: 'NOTE', headline: 'Investment Banks: Make sure to provide prices closer to the market price than the exchange!', impact: 0 },

  // MACRO
  { ticker: 'MACRO', headline: 'The economic recovery from the pandemic recession has been rocky, with surges in economic output hampered by supply shortages', impact: -0.15 },
  { ticker: 'MACRO', headline: 'By the end of 2021, the US economy had not only recovered but also exceeded its pre-recession output level by 3.2%', impact: 0.25 },
  { ticker: 'MACRO', headline: 'Global growth expected to decelerate from 5.5% in 2021 to 4.1% in 2022, owing to ongoing COVID-19 flare-ups', impact: -0.2 },
  { ticker: 'MACRO', headline: 'Higher food and energy prices, and more anticipated supply disruptions — near-term outlook for growth is weaker', impact: -0.3 },
  { ticker: 'MACRO', headline: 'Global inflation is significantly higher than previously anticipated', impact: -0.25 },
  { ticker: 'MACRO', headline: 'UPDATE: U.S. Employment Data to be released in 1 minute. Expected: 420k jobs', impact: 0.1 },
  { ticker: 'MACRO', headline: 'U.S. labour market indicates a much stronger rebound in job creation over the summer', impact: 0.3 },
  { ticker: 'MACRO', headline: 'Federal Reserve signals potential rate hike in upcoming meeting', impact: -0.35 },
  { ticker: 'MACRO', headline: 'US GDP growth revised upward to 3.2% for Q3', impact: 0.3 },

  // NFLX
  { ticker: 'NFLX', headline: 'Netflix added 8.3 million new subscribers in the final months of 2021, closing the year with 221.8 million subscribers', impact: 0.3 },
  { ticker: 'NFLX', headline: 'Netflix fell short of their own predictions by 230,000 fewer subscribers in Q4 2021 as lockdown measures ease', impact: -0.4 },
  { ticker: 'NFLX', headline: 'UPDATE: Netflix Q3 Earnings to be released in 1 minute. Revenue Exp: $6.4bn', impact: -0.05 },
  { ticker: 'NFLX', headline: 'Netflix misses Revenue Expectations in latest Earnings Report, coming out at $5.8bn', impact: -0.6 },
  { ticker: 'NFLX', headline: 'Netflix ad-supported tier reaches 40 million subscribers globally', impact: 0.4 },

  // MSFT
  { ticker: 'MSFT', headline: 'Microsoft total company revenue climbed almost 22% year over year, the fastest growth since 2018', impact: 0.5 },
  { ticker: 'MSFT', headline: 'Microsoft stock rose the most since April 2020 after Azure cloud-computing forecast reassured investors', impact: 0.4 },
  { ticker: 'MSFT', headline: 'Microsoft introduced new Surface PCs and hired Amazon cloud executive Charlie Bell for cybersecurity', impact: 0.2 },
  { ticker: 'MSFT', headline: 'Microsoft faces EU antitrust scrutiny over Teams bundling with Office 365', impact: -0.3 },

  // SPX
  { ticker: 'SPX', headline: 'S&P 500 has posted at least one new record close every month since November 2020', impact: 0.2 },
  { ticker: 'SPX', headline: "During 2021, the S&P500's best-performing sectors were energy and real estate, both increasing over 40%", impact: 0.3 },
  { ticker: 'SPX', headline: 'Tech and financials rose more than 30% in 2021. Growth stocks maintained a strong pace', impact: 0.25 },

  // UST
  { ticker: 'UST', headline: 'Bond markets face rising inflation threat, unseating government-bond markets', impact: -0.5 },
  { ticker: 'UST', headline: 'Interest rates rose in 2021 with significant volatility as investors grappled with inflation outlook', impact: -0.4 },
  { ticker: 'UST', headline: "Federal Reserve's hawkish pivot in Q4 adds pressure to Treasury yields", impact: -0.35 },
  { ticker: 'UST', headline: 'Flight to safety as global uncertainty rises — Treasury demand surges', impact: 0.5 },

  // OIL
  { ticker: 'OIL', headline: 'Crude oil prices rose in 2021 as rising vaccination rates eased pandemic restrictions', impact: 0.4 },
  { ticker: 'OIL', headline: 'WTI crude oil started the year at $40/barrel and rose to a high of $76 in late October before falling', impact: 0.3 },
  { ticker: 'OIL', headline: 'Increasing crude oil demand and lower supply resulted in consistent global inventory withdrawals', impact: 0.5 },
  { ticker: 'OIL', headline: 'Oil prices surge 5% amid Middle East tensions', impact: 0.45 },
  { ticker: 'OIL', headline: 'OPEC+ agrees to increase production — oil prices pull back sharply', impact: -0.5 },

  // WHEAT
  { ticker: 'WHEAT', headline: 'Global wheat supply expectations decline — 2021/22 forecast at 775mt, down from 789mt', impact: 0.4 },
  { ticker: 'WHEAT', headline: 'Poorer harvests in Russia, Canada, and the US contributed to supply tightening', impact: 0.5 },
  { ticker: 'WHEAT', headline: 'Global wheat consumption expected to increase by 1.4% to more than 785 million tonnes', impact: 0.3 },
  { ticker: 'WHEAT', headline: 'Favorable weather forecasts ease wheat supply concerns, prices moderate', impact: -0.35 },

  // More notes
  { ticker: 'NOTE', headline: 'Asset Managers: Remember to build diversified Multi Asset portfolios — $20M capital, long and short strategies', impact: 0 },
  { ticker: 'NOTE', headline: 'Investment Banks: When trading out of risk on the exchange, break up into smaller execution sizes to manage market impact', impact: 0 },
];

export const PLAYER_NAMES = [
  'Deal Room', 'David', 'Allan', 'Rasheed', 'Elizabeth', 'Brisard',
  'Chen Wei', 'Sofia', 'Marcus', 'Yuki', 'Priya', 'Liam',
  'Fatima', 'James', 'Olga', 'Kai', 'Nadia', 'Roberto',
  'Anika', 'Omar', 'Chloe', 'Darius', 'Elena', 'Felix',
  'Grace', 'Hassan', 'Iris', 'Jasper', 'Keiko', 'Lars',
  'Mina', 'Noah', 'Olivia', 'Pavel', 'Quinn', 'Rosa',
  'Samuel', 'Tara', 'Ulrich', 'Vera', 'Wyatt', 'Xena',
  'Yusuf', 'Zara', 'Aaron', 'Bella', 'Connor', 'Diana', 'Eric',
  'Lucian', 'Harper', 'Theo', 'Luna', 'Oscar', 'Ivy',
  'Ethan', 'Maya', 'Caleb', 'Aria', 'Leo', 'Zoe',
  'Max', 'Lily', 'Owen', 'Ella', 'Axel', 'Ruby',
  'Finn', 'Mila', 'Hugo', 'Nora', 'Atlas', 'Stella',
  'Jude', 'Hazel', 'Rowan', 'Iris', 'Asher', 'Willow',
  'Nico', 'Freya', 'Silas', 'Jade', 'Rhys', 'Poppy',
  'Miles', 'Sage', 'Bodhi', 'Wren', 'Ezra', 'Thea',
  'Kit', 'Alma', 'Arlo', 'Bea', 'Cruz', 'Dove'
];

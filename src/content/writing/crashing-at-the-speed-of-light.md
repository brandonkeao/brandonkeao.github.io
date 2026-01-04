---
title: "Crashing at the Speed of Light"
description: "Examining the July 2015 NYSE outage and systemic vulnerabilities in electronic trading infrastructure."
date: 2015-07-13
tags: ["technology", "finance"]
---

![NYSE Trading Floor](/images/blog/nyse.jpg)

On July 8th, 2015, people across America were freaking out. United Airlines grounded flights due to a network issue, the Wall Street Journal's website went down, and perhaps most frighteningly the New York Stock Exchange (NYSE) went down for over 3 hours. In typical freakout mode, people feared the worst: a terrorist attack. Those fears have subsided since last week but there's still fear and concern about the stability of our country's electronic financial markets.

## Flash crashes

The crash on Wednesday was due to "an internal technical issue" according to leadership at the NYSE. We've seen issues like these manifest before. In 2010, there was the Flash Crash. In 2012, Knight Capital Group lost $440 million after an incomplete production code release. In 2013, NASDAQ went down for a few hours due to a software bug. Much of this is well described in Michael Lewis's book, *Flash Boys*, which talks about the proliferation of high-frequency trading as well as the introduction of increasingly complex order types. In the past there were only a limited number of simple orders types: market orders (filled at market price), limit orders (filled at a specific price), and maybe a few more. Now there are dozens of order types and the list is growing and they become more and more complex.

## Hairballs and elephants

For eight years I worked as a management and tech consultant in the electronic trading industry, working closely with traders and programmers to help design, implement, and test their computer trading systems. The one thing that still sticks out in my mind is this intersection between traders and coders. Typically if traders ask for a technical feature today, they want it yesterday. There is constantly a push to get new features out the door. This often results in the creation of hairballs: tangled masses of spaghetti code that are a nightmare to support or debug. Worse than that these hairballs become elephants: massive platforms built on top of these spaghetti code systems which grow too large to fix.

## The price of complexity

So can we be proactive and prevent future issues before they occur? Yes and no. For the larger exchanges, it requires a massive redesign of their existing systems and development techniques. For smaller exchanges, it takes the will to put better coding and testing practices in place early on. Some exchanges have embraced this. One of my past projects involved building an automated testing architecture that fully integrated into production software prior to official release. This included detailed data analytics and business-level reports. Unfortunately, this is not the current trend in the industry and it looks like things will get worse before they get better in the near future. The reality is that as long as these complex systems keep growing, it is going to be more difficult to test and maintain them.

## Competition to the rescue

The cost of complexity becomes clearer by the day. Enter competition. While technology has facilitated complexity leading to crashes, technology also gives us the answer. The existence of cheaper and more accessible technology has spawned the creation of more exchanges that are innovating to stay lean, competitive, and stable. The barrier to entry is slowing being lowered. New exchanges like the IEX are offering simple, non-complex trading alternatives. Even if one exchange falls apart, there will be others to accept order flow and keep markets alive. So while I am bearish on tech trading systems in the short term, I'm bullish in the long term.

It's easy to get swept up in the hype when it comes to crashing markets but it's also important to keep things in perspective. Technical issues have come up before but there are safeguards in place. Electronic exchanges have crashed but the free market survives.

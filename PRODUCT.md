# Product

## Register

product

## Users

Developers learning blockchain on Stellar/Soroban, working through the project across four classes. Their context is hands-on: they read the contracts, run the deploy, and also *play* the live app to feel the concepts the code implements. The job to be done is understanding the fungibility spectrum (fungible, semi-fungible, non-fungible) by collecting, not by reading definitions. Secondary audience: anyone the team shows the demo to (conference booth, onboarding), who should "get it" in under two minutes without knowing what a wallet is.

## Product Purpose

A sticker-album dApp on Stellar testnet that teaches the full fungibility spectrum by being playable. You claim a fungible coin, spend it on a fungible sealed pack, rip the pack open (fungibility collapses into three semi-fungible stickers), paste stickers into a soulbound album (the one non-fungible thing you own), and trade duplicates through a trustless escrow. Each step is a different point on the spectrum, made tangible. Success is a developer who, after a few minutes, can point at the screen and say which thing is fungible, which is semi-fungible, and why, and who reached for "open another pack" because it felt good.

## Brand Personality

Playful, crafted, credible. The joy of tearing open a pack of trading cards, built with the precision of a tool a developer would trust. Voice is warm and plain: it names actions ("claim", "open", "paste", "trade"), not transactions. It never talks down and never hypes. Three words: joyful, tactile, trustworthy.

## Anti-references

- **Generic web3 / crypto**: neon-on-black, glows, glassmorphism, "Connect Wallet" as the whole personality. This is the first reflex for anything on-chain; reject it.
- **Corporate SaaS dashboard**: identical card grids, hero-metric tiles, purple gradients, sidebar-and-topbar app shell. The collectible is not an analytics product.
- **Childish / cartoonish**: Comic Sans energy, primary-color overload, balloon buttons. Playful is the goal; childish is the failure mode. The audience is engineers.

## Design Principles

- **The pack-rip is the lesson.** Opening a pack is the emotional peak and the exact moment fungibility collapses into unique items. Protect that moment above any other polish; never bury it under a spinner.
- **Show the spectrum, don't label it.** A coin reads as a quantity (a number that rises and falls). A sticker reads as an identifiable object (face, name, rarity). The album reads as the single unique thing you own. The visual contrast between these does the teaching.
- **Playful, not childish.** Collectible joy with dev-grade craft. It should feel fun to a kid and credible to an engineer; if it tips into toy, it has failed the audience.
- **Hide the chain, reveal on demand.** No seed phrases, gas, or transaction jargon in the main flow. Offer a quiet "view on explorer" path for the curious developer who wants to see it is real.
- **Every state is honest.** Cooldowns, escrow custody, and irreversible pasting are shown plainly and in the user's language, not hidden or dressed up as something they are not.

## Accessibility & Inclusion

Target WCAG AA: sufficient contrast on text and interactive elements, visible focus states, full keyboard operability for the core loop (claim, buy, open, paste, trade). Known consideration: rarity is currently conveyed by color (common / rare / legendary); the rarity tier is also written as text on each sticker, so meaning does not rely on color alone.

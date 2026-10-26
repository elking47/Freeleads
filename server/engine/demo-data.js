// Demo provider data. Every company and person here is fictional and every domain uses the reserved
// `.example` TLD (RFC 2606), so demo contacts can never reach a real inbox. Phone numbers use the
// French range reserved for fiction (06 39 98 xx xx).

export const COMPANIES = [
  { name: "Lumora Health", domain: "lumora-health.example", sector: "HealthTech", size: "11–50", city: "Paris", stack: "React, Node.js, PostgreSQL" },
  { name: "Cobaltine", domain: "cobaltine.example", sector: "B2B SaaS", size: "51–200", city: "Lyon", stack: "Vue, Laravel, AWS" },
  { name: "Atelier Brume", domain: "atelier-brume.example", sector: "Fashion", size: "11–50", city: "Paris", stack: "Shopify, Klaviyo" },
  { name: "Vertiflow", domain: "vertiflow.example", sector: "AgriTech", size: "11–50", city: "Nantes", stack: "Python, Django, GCP" },
  { name: "Orbelle", domain: "orbelle.example", sector: "Cosmetics", size: "51–200", city: "Bordeaux", stack: "Shopify Plus, HubSpot" },
  { name: "Kaskad Studio", domain: "kaskad.example", sector: "Gaming", size: "11–50", city: "Montpellier", stack: "Unity, C#" },
  { name: "Pommeraie Foods", domain: "pommeraie.example", sector: "Food & Beverage", size: "201–500", city: "Rennes", stack: "Salesforce, WordPress" },
  { name: "Nexalune", domain: "nexalune.example", sector: "FinTech", size: "51–200", city: "Paris", stack: "TypeScript, Next.js, Kubernetes" },
  { name: "Tidewell Energy", domain: "tidewell.example", sector: "CleanTech", size: "51–200", city: "Marseille", stack: "Angular, Java, Azure" },
  { name: "Brindille", domain: "brindille.example", sector: "EdTech", size: "11–50", city: "Lille", stack: "React Native, Firebase" },
  { name: "Fernlight Media", domain: "fernlight.example", sector: "Media", size: "11–50", city: "Paris", stack: "WordPress, Webflow" },
  { name: "Solvane", domain: "solvane.example", sector: "Cybersecurity", size: "51–200", city: "Toulouse", stack: "Go, React, AWS" },
  { name: "Opaline Finance", domain: "opaline.example", sector: "Wealth management", size: "51–200", city: "Paris", stack: "Webflow, HubSpot" },
  { name: "Rivemont Consulting", domain: "rivemont.example", sector: "Consulting", size: "201–500", city: "Paris", stack: "Microsoft 365, Power BI" },
  { name: "Quartzite Robotics", domain: "quartzite.example", sector: "Robotics", size: "11–50", city: "Grenoble", stack: "ROS, Python, React" },
  { name: "Hélia Travel", domain: "helia-travel.example", sector: "Travel", size: "51–200", city: "Nice", stack: "Next.js, Contentful" },
  { name: "Corbeau Audio", domain: "corbeau-audio.example", sector: "Consumer electronics", size: "11–50", city: "Lyon", stack: "Shopify, Gorgias" },
  { name: "Lanterne", domain: "lanterne.example", sector: "EdTech", size: "1–10", city: "Strasbourg", stack: "Bubble, Airtable" },
  { name: "Aubépine Cosmetics", domain: "aubepine.example", sector: "Cosmetics", size: "11–50", city: "Paris", stack: "Shopify, Meta Ads" },
  { name: "Gravelle Mobility", domain: "gravelle.example", sector: "Mobility", size: "51–200", city: "Lyon", stack: "Kotlin, Swift, Node.js" },
  { name: "Sérac Outdoor", domain: "serac-outdoor.example", sector: "Sporting goods", size: "51–200", city: "Annecy", stack: "Magento, Akeneo" },
  { name: "Tessera Legal", domain: "tessera-legal.example", sector: "LegalTech", size: "11–50", city: "Paris", stack: "Ruby on Rails, React" },
  { name: "Velours Maison", domain: "velours-maison.example", sector: "Home decor", size: "11–50", city: "Bordeaux", stack: "WooCommerce" },
  { name: "Ondine Water", domain: "ondine.example", sector: "Utilities", size: "201–500", city: "Toulouse", stack: "SAP, Sitecore" },
];

export const FIRST_NAMES = [
  "Camille", "Julien", "Inès", "Thomas", "Manon", "Hugo", "Sarah", "Antoine", "Chloé", "Nicolas",
  "Léna", "Mehdi", "Pauline", "Romain", "Yasmine", "Maxime", "Clara", "Karim", "Elise", "Baptiste",
];

export const LAST_NAMES = [
  "Moreau", "Laurent", "Garnier", "Benali", "Rousseau", "Fontaine", "Chevalier", "Morel", "Girard", "Lemaire",
  "Faure", "Mercier", "Bonnet", "Perrin", "Haddad", "Marchand", "Dupuis", "Leclerc", "Renaud", "Aubert",
];

// Listing templates per discipline. `{company}` and `{city}` are filled in by the demo source.
// The qualifier (stage 2) never sees `kind`; it is only here so the demo mixes in roles it must reject.
export const LISTING_TEMPLATES = {
  web: [
    { kind: "freelance", title: "Freelance React developer – 3-month mission", text: "{company} is rebuilding its customer dashboard and needs a freelance React developer for a 3-month mission. Remote-friendly, 3 days a week on site in {city}. Start ASAP. Daily rate €450–550/day." },
    { kind: "hidden", title: "Fullstack Node.js engineer", text: "We need help shipping our new billing module before our launch in early March. Contract possible. You'll work with our CTO on a scoped project: API design, Stripe integration and tests." },
    { kind: "freelance", title: "Shopify developer for store migration", text: "{company} is migrating from WooCommerce to Shopify. Looking for an independent developer for a one-off project of 6 weeks: theme, apps, data migration." },
    { kind: "hidden", title: "Senior front-end developer (mission)", text: "Mission to redesign our marketing site and component library. Part-time, 2 days a week, for 4 months. Next.js and Tailwind." },
    { kind: "fte", title: "Head of Engineering (CDI)", text: "Permanent full-time role in {city}. Lead a team of 12, career growth, stock options, hybrid policy." },
    { kind: "intern", title: "Web developer internship", text: "6-month internship (stage) for a student in computer science. Learn React and Node.js with our team." },
  ],
  marketing: [
    { kind: "freelance", title: "Freelance SEO consultant", text: "{company} wants a freelance SEO consultant to audit and fix technical SEO on 1,200 pages. 2-month mission, start immediately. Budget: daily rate to discuss." },
    { kind: "hidden", title: "Growth marketer – product launch", text: "We launch our new app next month and need a growth marketer to run paid acquisition for the launch campaign. 8-week contract, remote." },
    { kind: "freelance", title: "Google Ads specialist (contract)", text: "Contractor needed to restructure our Google Ads account and set up tracking. Project-based, 3 weeks." },
    { kind: "hidden", title: "CRM & lifecycle manager", text: "Mission: rebuild our Klaviyo flows and segmentation before Black Friday. 2 days a week for 3 months." },
    { kind: "fte", title: "Marketing Director", text: "Permanent position (CDI), full-time employee in {city}. Manage a team of 6 and the annual budget." },
    { kind: "intern", title: "Marketing intern", text: "Alternance or internship in our marketing team, 12 months." },
  ],
  design: [
    { kind: "freelance", title: "Freelance brand designer – rebrand", text: "{company} is going through a full rebrand: logo, typography, brand guidelines. Looking for a freelance designer for a 6-week mission. Start ASAP." },
    { kind: "hidden", title: "Packaging designer", text: "One-off project: design the packaging of our new product range (8 SKUs) for a launch in early April." },
    { kind: "freelance", title: "UI designer (contract)", text: "Contract of 2 months to redesign our mobile app in Figma, part-time possible." },
    { kind: "fte", title: "Lead product designer", text: "Full-time employee role, permanent contract, hybrid in {city}, career growth and stock options." },
    { kind: "intern", title: "Graphic design internship", text: "Internship (stage) of 6 months in our in-house studio." },
  ],
  copywriting: [
    { kind: "freelance", title: "Freelance SEO copywriter", text: "{company} needs a freelance copywriter to produce 20 SEO articles over 2 months. Daily rate €300–400/day." },
    { kind: "hidden", title: "Technical writer – API docs", text: "Mission: rewrite our developer documentation before our public API launch next month. 6-week contract." },
    { kind: "freelance", title: "Website copy for redesign", text: "One-off project: write the copy for our new website (12 pages). Independent writers welcome." },
    { kind: "fte", title: "Content manager (CDI)", text: "Permanent full-time role to own our editorial calendar." },
    { kind: "intern", title: "Content intern", text: "Internship in our content team, 6 months." },
  ],
  video: [
    { kind: "freelance", title: "Freelance motion designer – 4 launch videos", text: "{company} is launching and needs 4 short motion videos for social media. Freelance mission of 4 weeks, start ASAP." },
    { kind: "hidden", title: "Head of Content", text: "Posted as a full role but the immediate need is a 6-week motion project for our product launch. Contract possible for the right profile." },
    { kind: "freelance", title: "Video editor for YouTube channel", text: "Our 500k-subscriber channel is looking for a long-term freelance editor: 2 videos per week, part-time." },
    { kind: "fte", title: "Video producer (permanent)", text: "Permanent full-time employee position in {city}." },
    { kind: "intern", title: "Video editing internship", text: "Internship (stage) in our studio, 6 months." },
  ],
  communications: [
    { kind: "freelance", title: "Freelance PR consultant", text: "{company} needs a freelance PR consultant for its Series A announcement. 6-week mission starting next month." },
    { kind: "hidden", title: "Event communications lead", text: "Mission to run communications for our annual conference in {city}: press kit, speakers, social. 2-month contract." },
    { kind: "freelance", title: "Brand content strategist (contract)", text: "Contractor to define our brand voice and editorial guidelines. Project-based, 3 weeks." },
    { kind: "fte", title: "Communications manager (CDI)", text: "Permanent position, full-time, career growth." },
  ],
  photography: [
    { kind: "freelance", title: "Product photographer – new collection", text: "{company} needs a freelance photographer for a 3-day shoot of our new collection in {city}. Start next month." },
    { kind: "hidden", title: "Corporate photographer", text: "One-off project: team portraits and office photos for our new website. Urgent, this week if possible." },
    { kind: "freelance", title: "E-commerce photographer (contract)", text: "Contract for packshots of 150 products, 2 weeks, daily rate to discuss." },
    { kind: "intern", title: "Photography assistant intern", text: "Internship (stage) assisting our in-house photographer." },
  ],
  sales: [
    { kind: "freelance", title: "Freelance SDR – outbound launch", text: "{company} is opening the UK market and needs a freelance SDR to build pipeline for 3 months. Part-time possible." },
    { kind: "hidden", title: "Business developer", text: "We need someone to set up our outbound process (sequences, CRM, scripts) as a 2-month mission before we hire a team." },
    { kind: "freelance", title: "Sales consultant (contract)", text: "Contractor to design our sales playbook and train 4 reps. Project-based, 6 weeks." },
    { kind: "fte", title: "Account Executive (CDI)", text: "Permanent full-time role with uncapped commission and career growth." },
    { kind: "intern", title: "Sales intern", text: "Business development internship, 6 months, alternance possible." },
  ],
};

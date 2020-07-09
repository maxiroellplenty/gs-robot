const axios = require("axios");
const cheerio = require("cheerio");
const ObjectsToCsv = require("objects-to-csv");
const yargs = require("yargs");

const argv = yargs
  .option("wo", {
    description: "Welche Stadt",
    type: "string",
  })
  .option("was", {
    description: "Was soll gesucht werden",
    type: "string",
  })
  .option("umkreis", {
    description: "Umkreis in dem gesucht werden soll, Standard=50000 (50km)",
    type: "string",
  })
  .option("output", {
    description: "Dateipfad (Name) für die Ergebnisdatei",
    type: "string",
  })
  .help()
  .alias("help", "h").argv;

// Config

let was = "";
let wo = "";
let output = "./result.csv";
let umkreis = 50000;
let valid = true;
const debug = false;

if (argv.wo) {
  wo = argv.wo;
} else {
  valid = false;
  console.log("option: --wo muss gesetzt werden");
}
if (argv.was) {
  was = argv.was;
} else {
  valid = false;
  console.log("option: --was muss gesetzt werden");
}
if (argv.umkreis) {
  umkreis = argv.umkreis;
}
if (argv.output) {
  output = argv.output;
}

const params = "?umkreis=" + umkreis;
const url = "https://www.gelbeseiten.de/Suche/" + was + "/" + wo;
const results = [];
let startTime;
if (valid) {
  logo();
  // initial request
  startTime = new Date();
  axios(url + params)
    .then((res) => {
      const html = res.data;
      const $ = cheerio.load(html);
      const entrySize = $("#loadMoreGesamtzahl").text();
      const pages = Math.ceil(Number(entrySize) / 50);
      console.log("Entries: " + entrySize);
      let requests = [];
      for (var i = 1; i <= pages; i++) {
        requests.push(request(i));
      }
      if (debug) console.log(requests);
      axios.all(requests.map(url => axios.get(url)))
      .then(axios.spread(async function (...res) {
        res.forEach((rawPage) =>
        {
            parseData(rawPage);
        })
        let endTime = new Date();
        console.log('Execution time: ' + (endTime - startTime) + 'ms');
        const csv = new ObjectsToCsv(results)
        await csv.toDisk(output)
        console.log('Suche abgeschlossen.');
        console.log('Daten wurden unter ' + output + ' gespeichert.');
      })).catch(console.error);;
    })
    .catch(console.error);
} else {
  console.log('"node crawler.js --help" für mehr informationen');
}

function request(pageNumber) {
  if (debug) console.log(pageNumber);
  return url + "/Seite-" + pageNumber + params;
}

function parseData(response) {
  const html = response.data;
  const $ = cheerio.load(html);

  $(".mod-Treffer").each(function () {
    let name = $(this).find("h2").text();
    let address = $(this).find(".mod-AdresseKompakt :nth-child(1)").text();
    let ort = $(this).find(".mod-AdresseKompakt :nth-child(1).nobr").text();
    address = address.replace(/\t/g, "").replace(/\n/g, "");
    if(address)
    {
      addressParts = address.split(",");
    }
    if(ort)
    {
      ort = ort.replace(/\t/g, "").replace(/\n/g, "");
      ort = ort.substring(5, ort.length);
    }
    

   
    let street = addressParts[0];
    let plz = addressParts[1];
    if(plz)
    {
      plz = plz.substring(1, 6);
    }
    let phone = $(this).find(".mod-AdresseKompakt__phoneNumber").text();

    let entry = {
      Name: name,
      Street: street,
      Plz: plz,
      Ort: ort,
      Phone: phone,
    };
    results.push(entry);
  });
}

function logo() {
  console.log("G-Seiten Scraper by FrankWizard");
  console.log("-------------------------------");
  console.log("Search options:");
  console.log("- was: " + was);
  console.log("- wo: " + wo);
  console.log("- umkreis: " + umkreis);
  console.log("-------------------------------");
  console.log("Started search");
}

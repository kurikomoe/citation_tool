// Configs
const config = require('./config');

// Third Modules
const bibtexParse = require('bibtex-parse');
const axios = require('axios');

// Electron
const { ipcRenderer, ipcMain, remote } = require('electron');
// const electron = require('electron');
const ipc = ipcRenderer;
const ipcM = ipcMain;
// const remote = electron.remote;
// const Menu = remote.Menu;

// variables from global
const store = remote.getGlobal("store");
const store_author = remote.getGlobal("store_author");
const Global = remote.getGlobal("Global");

ipc.on('process_this_page', async () => {
  Global.is_processing = true;
  await process_page();
});

ipc.on('pause', () => {
  Global.stop_processing = true;
});

ipc.on('back', () => {
  Global.is_processing = false;
  history.back();
});

ipc.on('forward', () => {
  Global.stop_processing = true;
  history.forward();
});

ipc.on('reload', () => {
  Global.stop_processing = true;
  location.reload();
});

function is_recaptcha() {
  return document.querySelector('#gs_captcha_ccl') != null;
}

async function check_recaptcha() {
  if (is_recaptcha()) {
    await remote.dialog.showMessageBox({
      type: "warning",
      title: "Recaptcha",
      message: "ReCaptcha Pops, Please finish the recaptcha then click ok",
      buttons: ["Ok"],
    });
  }
}

function sleep(ms) {
  ms = ms + Math.floor(Math.random() * ms);
  return new Promise(resolve => setTimeout(resolve, ms));
}

function get_papers() {
  return document.querySelectorAll('h3');
}

async function parse_bibtex(biburl) {
  // Use the cors proxy
  // const proxyurl = "https://localhost:8080";
  const proxyurl = "";
  let bib = await fetch(proxyurl + biburl) // https://cors-anywhere.herokuapp.com/https://example.com
    .then(response => response.text())
    .then(contents => bibtexParse.entries(contents))
    .catch(() => console.log("Can’t access " + biburl + " response. Blocked by browser?"))

  if (bib === null || bib.length !== 1) {
    Global.is_processing = false;
    console.error("recaptcha in bib!");

    Global.do_bib_url_recaptcha = true;
    Global.last_url = location.href;
    location.href = biburl;

    location.reload();
    return null;
  }

  // console.log(bib);
  return bib[0];  // assume that we only have one item
}

async function get_bib_url(cid) {
  return axios.get(`https://scholar.google.com/scholar?q=info:${cid}:scholar.google.com/&output=cite&scirp=0&hl=en`)
    .then(response => {
      let el = document.createElement('html');
      el.innerHTML = response.data;

      let bib = el.querySelector('#gs_citi').firstChild;
      return bib['href'];
    })
    .catch(console.error);
}

function get_paper_attributes(paper_el) {
  let parent = paper_el.parentElement.parentElement;
  let cid = parent.getAttribute('data-cid');
  let did = parent.getAttribute('data-did');
  let lid = parent.getAttribute('data-lid');
  let rp = parent.getAttribute('data-rp');

  let ref = paper_el.querySelector('a')?.href;
  let pdf = parent.firstChild.querySelector('a')?.href;

  // Get all known authors
  let authors = []
  for (let el of paper_el.nextSibling.querySelectorAll('a')) {
    let name = el.textContent;
    let profile = el.href;
    authors.push([name, profile])
  }

  let title = paper_el.textContent;

  return {
    title,
    cid, did, lid, rp,
    "ref": ref,
    "pdf": pdf,
    authors_raw: authors,
  };
}

function get_ref_paper_name() {
  return document.querySelector('.gs_rt').innerText;
}

function process_name(name) {
  let [second, first] = name.split(',');
  // console.log(second, first)
  let ret = ""
  if (first) {
    ret += first;
    first = first.trim();
  }
  ret += " ";
  if (second) {
    ret += second;
    second = second.trim();
  }
  return (first + " " + second).trim();

}

async function process_page() {
  Global.is_processing = false;
  await check_recaptcha();
  let name = get_ref_paper_name();
  console.log(`Processing Paper: ${name}`);

  let elements = get_papers();
  for (let el of elements) {
    if (Global.stop_processing === true) {
      Global.stop_processing = false;
      console.log("Stop Process");
      return;
    }

    let attrs = get_paper_attributes(el);

    // Check Patterns
    if (attrs?.ref?.includes("patents.google.com")) {
      console.log("Ignore Patent")
      continue;
    }

    console.log(`「${attrs['title']}」`);
    // Check author info
    let authors_raw = attrs.authors_raw;
    for (let i = 0; i < authors_raw?.length; i++) {
      let name = authors_raw[i][0];
      let inst = authors_raw[i][1];
      if (inst.includes("http")) {
        // re-parse inst
        let safe_inst = inst;
        let query = store_author.get(`${safe_inst}`);
        if (query) {
          // console.log(query);
          authors_raw[i] = query;
        } else {
          authors_raw[i] = await axios.get(inst).then((res) => {
            let el = document.createElement('html');
            el.innerHTML = res.data;
            let name_el = el.querySelector("#gsc_prf_in");
            let name = name_el.textContent;
            let inst = name_el.parentElement.nextSibling.textContent;
            return [name, inst];
          });
          // console.log(authors_raw[i])
          store_author.set(`${safe_inst}`, authors_raw[i]);
          await sleep(config.GET_AUTHOR_DELAY);
        }
      }
    }
    attrs.authors_raw = authors_raw;

    let ret = store.get(`${name}.${attrs['title']}.bib`);
    if (ret) {
      attrs.bib = ret;
      store.set(`${name}.${attrs['title']}`, attrs);
      continue;
    }

    store.set(`${name}.${attrs['title']}`, attrs);
    let biburl = await get_bib_url(attrs['cid']);
    let bib = await parse_bibtex(biburl);
    bib['AUTHOR'] = bib["AUTHOR"]
      .split("and")
      .map(el => el.trim())
      .map(process_name);
    store.set(`${name}.${attrs['title']}.bib`, bib);

    // TODO(kuriko): Check the recaptcha.
    await check_recaptcha();

    await sleep(config.GET_BIB_DELAY);
  }
  let cnt = elements.length;
  if (cnt !== 10) {
    Global.is_processing = false;
    alert("FINISHED");
  } else {
    await sleep(config.SLEEP);
    Global.is_processing = true;
    console.info("jump to next page");
    let el = document.querySelector('tbody').firstChild.lastChild.querySelector('a').lastChild;
    window.scrollTo(el);
    el.click();
  }
}

window.addEventListener('DOMContentLoaded', async () => {
  console.log("Global: ", Global);
  if (Global.do_bib_url_recaptcha) {
    await check_recaptcha();
    Global.do_bib_url_recaptcha = false;
    location.href = Global.last_url;
  }
  if (Global.is_processing) {
    await process_page();
  }
})


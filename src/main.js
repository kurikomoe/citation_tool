// Modules to control application life and create native browser window
const { app, BrowserWindow, Menu, session } = require('electron')
const randomUseragent = require('random-useragent');
const path = require('path')
const Store = require('electron-store');

let ua = randomUseragent.getRandom(function (ua) {
  // return parseFloat(ua.browserVersion) >= 70 && ua.browserName === 'Chrome';
  return ua.browserName === 'Chrome';
});
console.log(ua);

const store = new Store({ name: "scholar", cwd: app.getAppPath() + '/db/' });
global.store = store;
global.Global = {
  is_processing: false,
  stop_processing: false,
  last_url: "",
  do_bib_url_recaptcha: false,
}

app.commandLine.appendSwitch('disable-features', 'OutOfBlinkCors')

function createWindow() {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    webPreferences: {
      webSecurity: false,
      nodeIntegration: true,
      enableRemoteModule: true,
      preload: path.join(__dirname, 'preload.js')
    }
  })
  mainWindow.webContents.userAgent = ua;
  mainWindow.webContents.session.clearStorageData();

  const menu = Menu.buildFromTemplate([
    {
      label: "Application",
      submenu: [
        { label: "About" },
      ],
    },
    {
      label: 'Kuriko Functions',
      submenu: [
        {
          label: 'start',
          accelerator: 'Ctrl+r',
          click() {
            mainWindow.webContents.send('process_this_page');
          }
        },
        {
          label: 'pause',
          accelerator: 'Ctrl+e',
          click() {
            mainWindow.webContents.send('pause');
          }
        },
        { label: 'resume' },
        {
          label: 'quit',
          accelerator: 'cmd+q',
          click: app.quit,
        },
      ]
    }, {
      label: "Edit",
      submenu: [
        {
          label: 'Undo',
          role: 'undo',
        },
        {
          label: 'Redo',
          role: 'redo',
        },
        {
          type: 'separator',
        },
        {
          label: 'Cut',
          role: 'cut',
        },
        {
          label: 'Copy',
          role: 'copy',
        },
        {
          label: 'Paste',
          role: 'paste',
        },
        {
          type: 'separator',
        },
        {
          label: 'Select all',
          role: 'selectall',
        },
      ]

    }, {
      label: "View",
      submenu: [
        {
          label: 'Back',
          role: 'back',
          click() {
            mainWindow.webContents.send('back');
          }
        },
        {
          label: 'Forward',
          role: 'forward',
          click() {
            mainWindow.webContents.send('forward');
          }
        },
        {
          label: 'Reload',
          role: 'reload',
          click() {
            mainWindow.webContents.send('reload');
          }
        },
      ]

    }

  ])
  Menu.setApplicationMenu(menu);

  // and load the index.html of the app.
  // mainWindow.loadFile("src/index.html")
  mainWindow.loadURL("https://scholar.google.com",
    { userAgent: ua });

  // Open the DevTools.
  mainWindow.webContents.openDevTools()
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  let ua = randomUseragent.getRandom(function (ua) {
    return parseFloat(ua.browserVersion) >= 70 && ua.browserName === 'Chrome';
  });


  await session.defaultSession.cookies.get({}, (error, cookies) => {
    cookies.forEach((cookie) => {
      let url = '';
      // get prefix, like https://www.
      url += cookie.secure ? 'https://' : 'http://';
      url += cookie.domain.charAt(0) === '.' ? 'www' : '';
      // append domain and path
      url += cookie.domain;
      url += cookie.path;

      console.log(url);

      session.defaultSession.cookies.remove(url, cookie.name, (error) => {
        if (error) console.log(`error removing cookie ${cookie.name}`, error);
      });
    });
  });

  await session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    details.requestHeaders['User-Agent'] = ua;
    callback({ cancel: false, requestHeaders: details.requestHeaders });
  });

  console.log("CreateWindow");
  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', function () {
  console.log("quitting");
  app.quit();
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.

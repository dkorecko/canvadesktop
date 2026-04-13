const { app, BrowserWindow, shell, session } = require('electron')

const canvaUrl = 'https://www.canva.com/'

function isAllowedUrl(rawUrl) {
  try {
    const url = new URL(rawUrl)

    if (url.protocol !== 'https:') {
      return false
    }

    return true
  } catch {
    return false
  }
}

function openInBrowser(rawUrl) {
  if (isAllowedUrl(rawUrl)) {
    shell.openExternal(rawUrl)
  }
}

function denyPermissionRequest(webContents, permission, callback) {
  callback(false)
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    icon: 'icon/canva.ico',
    title: 'Canva',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false,
      devTools: false,
      spellcheck: false,
      allowRunningInsecureContent: false,
      webSecurity: true
    }
  })

  mainWindow.removeMenu()

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    openInBrowser(url)

    return { action: 'deny' }
  })

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!isAllowedUrl(url)) {
      event.preventDefault()
    }
  })

  mainWindow.webContents.on('will-redirect', (event, url) => {
    if (!isAllowedUrl(url)) {
      event.preventDefault()
    }
  })

  mainWindow.loadURL(canvaUrl)
}

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler(denyPermissionRequest)
  session.defaultSession.setPermissionCheckHandler(() => false)

  app.on('web-contents-created', (_, contents) => {
    contents.on('will-attach-webview', event => {
      event.preventDefault()
    })
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

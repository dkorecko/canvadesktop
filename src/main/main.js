const { app, BrowserWindow, shell, session } = require('electron')

const canvaUrl = 'https://www.canva.com/'
const trustedHostSuffixes = [
  'canva.com',
  'google.com',
  'googleapis.com',
  'googleusercontent.com',
  'gstatic.com'
]
const popupHostSuffixes = ['google.com', 'googleapis.com', 'googleusercontent.com']

function isTrustedHost(hostname) {
  return trustedHostSuffixes.some(suffix => hostname === suffix || hostname.endsWith(`.${suffix}`))
}

function isPopupHost(hostname) {
  return popupHostSuffixes.some(suffix => hostname === suffix || hostname.endsWith(`.${suffix}`))
}

function isAllowedUrl(rawUrl) {
  try {
    const url = new URL(rawUrl)

    if (url.protocol !== 'https:') {
      return false
    }

    return isTrustedHost(url.hostname)
  } catch {
    return false
  }
}

function isExternalUrl(rawUrl) {
  try {
    const url = new URL(rawUrl)

    return url.protocol === 'https:'
  } catch {
    return false
  }
}

function openInBrowser(rawUrl) {
  if (isExternalUrl(rawUrl)) {
    shell.openExternal(rawUrl)
  }
}

function navigateWindow(window, rawUrl) {
  if (isAllowedUrl(rawUrl)) {
    window.loadURL(rawUrl)
  } else {
    openInBrowser(rawUrl)
  }
}

function isCanvaAuthCallback(rawUrl) {
  try {
    const url = new URL(rawUrl)

    return isTrustedHost(url.hostname) && url.pathname.startsWith('/oauth/authorized/')
  } catch {
    return false
  }
}

function denyPermissionRequest(webContents, permission, callback) {
  callback(false)
}

function createWindow() {
  const mainWindow = new BrowserWindow(createWindowOptions())

  configureWindow(mainWindow)
  mainWindow.loadURL(canvaUrl)
}

function createWindowOptions() {
  return {
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
  }
}

function configureWindow(window, openerWindow = null) {
  window.removeMenu()

  window.webContents.on('did-create-window', childWindow => {
    configureWindow(childWindow, window)
  })

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedUrl(url) && isPopupHost(new URL(url).hostname)) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          ...createWindowOptions(),
          width: 520,
          height: 760,
          minWidth: 520,
          minHeight: 640,
          modal: false,
          autoHideMenuBar: true
        }
      }
    }

    if (isAllowedUrl(url)) {
      navigateWindow(window, url)

      return { action: 'deny' }
    }

    openInBrowser(url)

    return { action: 'deny' }
  })

  window.webContents.on('will-navigate', (event, url) => {
    if (!isAllowedUrl(url)) {
      event.preventDefault()
      openInBrowser(url)
    }
  })

  window.webContents.on('will-redirect', (event, url) => {
    if (!isAllowedUrl(url)) {
      event.preventDefault()
      openInBrowser(url)
    }
  })

  if (openerWindow) {
    const finishAuthFlow = url => {
      if (!isCanvaAuthCallback(url)) {
        return
      }

      if (!openerWindow.isDestroyed()) {
        openerWindow.loadURL(url)
        openerWindow.focus()
      }

      if (!window.isDestroyed()) {
        window.close()
      }
    }

    window.webContents.on('did-navigate', (_, url) => {
      finishAuthFlow(url)
    })

    window.webContents.on('did-redirect-navigation', (_, url) => {
      finishAuthFlow(url)
    })
  }

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

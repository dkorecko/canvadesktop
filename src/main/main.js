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
const authDebugEnabled = true

function logAuth(eventName, details = {}) {
  if (!authDebugEnabled) {
    return
  }

  console.log(`[canva-auth] ${eventName}`, JSON.stringify(details))
}

function isTrustedHost(hostname) {
  return trustedHostSuffixes.some(suffix => hostname === suffix || hostname.endsWith(`.${suffix}`))
}

function isPopupHost(hostname) {
  return popupHostSuffixes.some(suffix => hostname === suffix || hostname.endsWith(`.${suffix}`))
}

function shouldOpenInPopup(rawUrl) {
  try {
    const url = new URL(rawUrl)

    if (isPopupHost(url.hostname)) {
      return true
    }

    return isTrustedHost(url.hostname) && url.pathname.startsWith('/oauth/authorize/')
  } catch {
    return false
  }
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
  logAuth('navigate-window', { targetUrl: rawUrl })

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

  logAuth('configure-window', {
    windowId: window.webContents.id,
    openerWindowId: openerWindow?.webContents.id ?? null
  })

  const completeAuthInOpener = (event, url) => {
    if (!openerWindow || !isCanvaAuthCallback(url)) {
      return false
    }

    logAuth('complete-auth-in-opener', {
      popupWindowId: window.webContents.id,
      openerWindowId: openerWindow.webContents.id,
      callbackUrl: url
    })

    if (!openerWindow.isDestroyed()) {
      openerWindow.loadURL(canvaUrl)
      openerWindow.focus()
    }

    return true
  }

  window.webContents.on('did-create-window', childWindow => {
    logAuth('did-create-window', {
      parentWindowId: window.webContents.id,
      childWindowId: childWindow.webContents.id
    })

    configureWindow(childWindow, window)
  })

  window.webContents.setWindowOpenHandler(({ url }) => {
    logAuth('set-window-open-handler', {
      windowId: window.webContents.id,
      targetUrl: url,
      allowed: isAllowedUrl(url),
      popup: shouldOpenInPopup(url)
    })

    if (isAllowedUrl(url) && shouldOpenInPopup(url)) {
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
    logAuth('will-navigate', {
      windowId: window.webContents.id,
      targetUrl: url,
      openerWindowId: openerWindow?.webContents.id ?? null
    })

    if (completeAuthInOpener(event, url)) {
      return
    }

    if (!isAllowedUrl(url)) {
      event.preventDefault()
      openInBrowser(url)
    }
  })

  window.webContents.on('will-redirect', (event, url) => {
    logAuth('will-redirect', {
      windowId: window.webContents.id,
      targetUrl: url,
      openerWindowId: openerWindow?.webContents.id ?? null
    })

    if (completeAuthInOpener(event, url)) {
      return
    }

    if (!isAllowedUrl(url)) {
      event.preventDefault()
      openInBrowser(url)
    }
  })

  window.webContents.on('did-navigate', (_, url) => {
    logAuth('did-navigate', {
      windowId: window.webContents.id,
      currentUrl: url,
      openerWindowId: openerWindow?.webContents.id ?? null
    })
  })

  window.webContents.on('did-redirect-navigation', (_, url, isInPlace, isMainFrame, frameProcessId, frameRoutingId) => {
    logAuth('did-redirect-navigation', {
      windowId: window.webContents.id,
      currentUrl: url,
      openerWindowId: openerWindow?.webContents.id ?? null,
      isInPlace,
      isMainFrame,
      frameProcessId,
      frameRoutingId
    })
  })

  window.webContents.on('did-finish-load', () => {
    logAuth('did-finish-load', {
      windowId: window.webContents.id,
      currentUrl: window.webContents.getURL(),
      openerWindowId: openerWindow?.webContents.id ?? null
    })

    if (openerWindow && isCanvaAuthCallback(window.webContents.getURL()) && !window.isDestroyed()) {
      window.close()
    }
  })

  window.webContents.on('did-fail-load', (_, errorCode, errorDescription, validatedUrl, isMainFrame) => {
    logAuth('did-fail-load', {
      windowId: window.webContents.id,
      errorCode,
      errorDescription,
      validatedUrl,
      isMainFrame,
      openerWindowId: openerWindow?.webContents.id ?? null
    })
  })

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

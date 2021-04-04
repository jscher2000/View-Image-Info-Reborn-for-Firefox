/* 
  View Image Info Reborn
  Copyright 2021. Jefferson "jscher2000" Scher. License: MPL-2.0.
  Script to handle menu clicks, coordinate among scripts, launch new windows/tabs
  version 1.0 - MVP
*/

/**** Create and populate data structure ****/

// Default starting values
var oPrefs = {
	/* menu action */
	menuplain: 'window',		// open popup window
	menushift: 'inpage',		// overlay info on image
	menuctrl: 'intab',			// open tab
	/* Styling */
	colorscheme: 'auto',		// auto / light / dark
	fontsize: 16				// font-size for text
}

// Update oPrefs from storage
browser.storage.local.get("prefs").then( (results) => {
	if (results.prefs != undefined){
		if (JSON.stringify(results.prefs) != '{}'){
			var arrSavedPrefs = Object.keys(results.prefs);
			for (var j=0; j<arrSavedPrefs.length; j++){
				oPrefs[arrSavedPrefs[j]] = results.prefs[arrSavedPrefs[j]];
			}
		}
	}
}).catch((err) => {console.log('Error retrieving "prefs" from storage: '+err.message);});

// Array of window/tab requests
let pops = [];

/**** Menu and Overlay Stuff ****/

// Right-click context menu entry
browser.menus.create({
	id: 'viewImageInfoReborn',
	title: 'View Image Info...',
	contexts: ['image']
});

// Kick off info display with a message to the content script
let watchlist = [];
browser.menus.onClicked.addListener((menuInfo, currTab) => {
	// Send message to the content script to gather information or show an overlay
	var imgmsg = {};
	// Check modifiers to determine action
	imgmsg.axn = 'window';
	switch (menuInfo.modifiers.length){
		case 0: //Plain
			imgmsg.axn = oPrefs.menuplain;
			break;
		case 1: // Shift or Ctrl
			if (menuInfo.modifiers.includes('Shift')){
				imgmsg.axn = oPrefs.menushift;
			} else if ((browser.runtime.PlatformOs == 'mac' && menuInfo.modifiers.includes('Command')) ||
						(browser.runtime.PlatformOs != 'mac' && menuInfo.modifiers.includes('Ctrl'))){
				imgmsg.axn = oPrefs.menuctrl;
			} else {
				// What is the user trying? Show the window.
			}
			break;
		default:
			// User held down two modifier keys? Show the window.
	}

	// Assemble reference information
	// Use time as object key
	imgmsg.now = Date.now();
	// Track source tab and reporting tab (initially the same)
	imgmsg.tabId = currTab.id;
	imgmsg.reportingTab = currTab.id;
	// Track frame in source tab (rarely applicable)
	imgmsg.frameId = menuInfo.frameId;
	// Track private window status (for new popup window)
	imgmsg.incognito = currTab.incognito;
	// Record info provided from the menu API
	imgmsg.targetElementId = menuInfo.targetElementId;
	imgmsg.sourceUrl = menuInfo.srcUrl;
	// Record user preferences
	imgmsg.colorscheme = oPrefs.colorscheme;
	imgmsg.fontsize = oPrefs.fontsize + 'px';
	// Add to array
	pops.push(imgmsg);
	
	// Update watchlist for header interception
	watchlist.push({
		id: imgmsg.now,
		url: imgmsg.sourceUrl,
		done: false
	});
	
	// Send instructions to the content script
	if (menuInfo.frameId == 0){ //main frame
		browser.tabs.sendMessage(
			currTab.id,
			{"getdetails": imgmsg}
		);
	} else { //need to inject CSS and execute script in this frame first before sending the message
		var styling = browser.tabs.insertCSS({
			frameId: menuInfo.frameId,
			file: 'view-image-info-content.css'
		});
		styling.then(() => {
			var executing = browser.tabs.executeScript({
				frameId: menuInfo.frameId,
				file: 'view-image-info-content.js'
			});
			executing.then(() => {
				browser.tabs.sendMessage(
					currTab.id,
					{"getdetails": imgmsg},
					{frameId: menuInfo.frameId}
				);
			});
		});
	}
})


/**** Handle Requests from Content and Options ****/
function handleMessage(request, sender, sendResponse){
	// Open info page in window or tab
	if ('showinfo' in request){
		// Update object with content details
		var oContentInfo = request.showinfo;
		var oImgInfo = pops.find(objRequest => objRequest.now === parseInt(oContentInfo.now));
		if (oImgInfo){
			oImgInfo.pageUrl = oContentInfo.pageUrl;
			oImgInfo.pageTitle = oContentInfo.pageTitle;
			oImgInfo.currentSrc = oContentInfo.currentSrc;
			oImgInfo.naturalHeight = oContentInfo.naturalHeight;
			oImgInfo.naturalWidth = oContentInfo.naturalWidth;
			oImgInfo.scaledHeight = oContentInfo.scaledHeight;
			oImgInfo.scaledWidth = oContentInfo.scaledWidth;
			oImgInfo.decodedSize = oContentInfo.decodedSize;
			oImgInfo.transferSize = oContentInfo.transferSize;
			oImgInfo.transferTime = oContentInfo.transferTime;
			oImgInfo.altText = oContentInfo.altText;
			oImgInfo.titleText = oContentInfo.titleText;
			oImgInfo.mimeType = oContentInfo.mimeType;
			oImgInfo.fileName = null;
			
			// Finally time to display it
			if (oImgInfo.axn == 'window'){
				// launch popup
				var w = browser.windows.create({
					type: 'popup', 
					incognito: request.showinfo.incognito,
					url: '/view-image-info-page.html?request=' + request.showinfo.now
				});
				w.then((winfo) => {
					oImgInfo.reportingTab = winfo.tabs[0].id;
				});
			} else if (oImgInfo.axn == 'intab'){
				// create tab
				var t = browser.tabs.create({
					url: '/view-image-info-page.html?request=' + request.showinfo.now
				});
				t.then((tinfo) => {
					oImgInfo.reportingTab = tinfo.id;
				});
			} else {
				// Probably 'inpage' so do nothing
			}
		} else {
			console.log('now not found!', oContentInfo, pops);
		}
	} else if ("senddetails" in request) {
		sendResponse({
			renderdata: pops.find(objRequest => objRequest.now === parseInt(request.senddetails))
		});
		return true;
	} else if ("options" in request) {
		browser.runtime.openOptionsPage();
	} else if ("update" in request) {
		// Receive pref hint from Options page and update oPrefs from storage
		if (request["update"] == 'fromStorage'){
			browser.storage.local.get("prefs").then((results) => {
				if (results.prefs != undefined){
					if (JSON.stringify(results.prefs) != '{}'){
						var arrSavedPrefs = Object.keys(results.prefs);
						for (var j=0; j<arrSavedPrefs.length; j++){
							oPrefs[arrSavedPrefs[j]] = results.prefs[arrSavedPrefs[j]];
						}
					}
				}
			}).catch((err) => {console.log('Error retrieving "prefs" from storage: '+err.message);});
		}
	}
}
browser.runtime.onMessage.addListener(handleMessage);

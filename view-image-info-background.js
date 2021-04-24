/* 
  View Image Info Reborn - Main Background Script
  Copyright 2021. Jefferson "jscher2000" Scher. License: MPL-2.0.
  Script to handle menu clicks, coordinate among scripts, launch new windows/tabs
  version 1.0 - MVP
  version 1.1 - bug fix, tweaks and options for stand-alone viewing
  version 1.3 - bug fixes for missing data
  version 1.4 - bug fixes for missing data
  version 1.5 - add Last-Modified, window/tab options
  version 1.6 - Save As options
  version 1.8 - Referrer for preview, popup position option, attribute list, updated layout
  version 1.8.1 - Adjust source URL conflict resolution to prefer currentSrc, check for picture tag
  version 1.9 - Menu choices, View Image in same tab
*/

/**** Create and populate data structure ****/

// Default starting values
var oPrefs = {
	/* menu action */
	menuplain: 'window',		// open popup window
	menushift: 'inpage',		// overlay info on image
	menuctrl: 'intab',			// open tab
	menustyle: 'single',		// single item or fly-out menu [v1.9]
	/* Styling */
	colorscheme: 'auto',		// auto / light / dark
	fontsize: 16,				// font-size for text
	popwidth: 'auto',			// width for popup window [v1.5]
	popheight: 'auto',			// height for popup window [v1.5]
	poptop: 'auto',				// top position for popup window [v1.8]
	popleft: 'auto',			// left position for popup window [v1.8]
	previewstyle: 'topthumb',	// or 'topfitw' or 'classic' for below [v1.8]
	maxthumbheight: 240,		// pixels [v1.9]
	tabinback: false,			// whether to open tab in the background [v1.5]
	autoopen: true				// show bar automatically on stand-alone image pages (FUTURE FEATURE)
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
}).then(() => {
	setupMenus();
}).catch((err) => {console.log('Error retrieving "prefs" from storage: '+err.message);});

// Array of window/tab requests
let pops = [];

/**** Menu and Overlay Stuff ****/

// Right-click context menu entry
var currentStyle;
function setupMenus(){
	currentStyle = oPrefs.menustyle;
	if (oPrefs.menustyle == 'single'){			// Traditional single item
		browser.menus.create({
			id: 'viewImageInfoReborn',
			title: 'View Image Info...',
			contexts: ['image']
		});
	} else if (oPrefs.menustyle == 'flyout'){	// Sub-menu items [v1.9]
		browser.menus.create({
			id: 'viewImageInfoRebornParent',
			title: 'View Image Info Reborn',
			contexts: ['image']
		});
		browser.menus.create({
			id: 'viir_viewImage',
			parentId: 'viewImageInfoRebornParent',
			title: 'View Image... in this tab',
			contexts: ['image'],
			"icons": {
				"32": "img/mountain-32.png"
			}
		})
		browser.menus.create({
			id: 'viir_window',
			parentId: 'viewImageInfoRebornParent',
			title: 'View Image Info in New Window',
			contexts: ['image'],
			"icons": {
				"32": "img/info-32.png"
			}
		})
		browser.menus.create({
			id: 'viir_tab',
			parentId: 'viewImageInfoRebornParent',
			title: 'View Image Info in New Tab',
			contexts: ['image'],
			"icons": {
				"32": "img/info-32.png"
			}
		})
		browser.menus.create({
			id: 'viir_overlay',
			parentId: 'viewImageInfoRebornParent',
			title: 'View Image Info in Overlay',
			contexts: ['image'],
			"icons": {
				"32": "img/info-32.png"
			}
		})
		browser.menus.create({
			id: 'viir_nowebp',
			parentId: 'viewImageInfoRebornParent',
			title: 'Save As... Request without image/webp',
			contexts: ['image'],
			"icons": {
				"32": "img/floppydisk-32.png"
			}
		})
		browser.menus.create({
			id: 'viir_asie11',
			parentId: 'viewImageInfoRebornParent',
			title: 'Save As... Request as Internet Explorer 11',
			contexts: ['image'],
			"icons": {
				"32": "img/floppydisk-32.png"
			}
		})
		browser.menus.create({
			id: 'viir_options',
			parentId: 'viewImageInfoRebornParent',
			title: 'Open the Options page',
			contexts: ['image'],
			"icons": {
				"32": "img/gear-32.png"
			}
		})
	}
}

// Kick off info display with a message to the content script
let watchlist = [];
var injectedFrames = [];
browser.menus.onClicked.addListener((menuInfo, currTab) => {
	if (menuInfo.menuItemId == 'viir_options'){
		browser.runtime.openOptionsPage();
		return;
	} else if (currTab.url.indexOf('moz-extension:') == 0 && currTab.url.indexOf('moz-extension:') > -1){
		// No recursion, please!
		browser.tabs.sendMessage(
			currTab.id,
			{"oopsmsg": "Please use the buttons in the popup window rather than the menu items. Also, View Image Info Reborn may not work in other extension pages."},
			{frameId: menuInfo.frameId}
		);
	} else {
		// Send message to the content script to gather information or show an overlay
		var imgmsg = {};
		imgmsg.axn = 'window';
		// Process menu choice
		if (menuInfo.menuItemId == 'viewImageInfoReborn'){			// Traditional single item
			// Check modifiers to determine action
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
		} else {													// Sub-menu [v1.9]
			switch (menuInfo.menuItemId){
				case 'viir_viewImage':
					imgmsg.axn = 'viewimg';
					break;
				case 'viir_tab':
					imgmsg.axn = 'intab';
					break;
				case 'viir_overlay':
					imgmsg.axn = 'inpage';
					break;
				case 'viir_nowebp':
					imgmsg.axn = 'reqnowebp';
					break;
				case 'viir_asie11':
					imgmsg.axn = 'reqasie11';
					break;
				default:
					// Show the window
			}
		}

		if (imgmsg.axn == 'viewimg' || imgmsg.axn == 'reqnowebp' || imgmsg.axn == 'reqasie11'){		// [v1.9]
			// build actions not related to displaying image info
			navToImage(currTab.id, imgmsg.axn, menuInfo.srcUrl, currTab.url, menuInfo.frameUrl);
			// don't both adding image to the pops array, etc.
			return;
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
		imgmsg.popwidth = oPrefs.popwidth;
		imgmsg.popheight = oPrefs.popheight;
		imgmsg.poptop = oPrefs.poptop;
		imgmsg.popleft = oPrefs.popleft;
		imgmsg.previewstyle = oPrefs.previewstyle;
		imgmsg.maxthumbheight = oPrefs.maxthumbheight;
		imgmsg.autoopen = oPrefs.autoopen;
		// Add to array (at beginning, so .find/.findIndex gets the latest match)
		pops.unshift(imgmsg);
		
		// Update watchlist for header interception
		watchlist.unshift({
			id: imgmsg.now,
			url: imgmsg.sourceUrl,
			currentSrcUrl: '',
			imgSrcUrl: '',
			fileName: '',
			lastMod: '',
			done: false
		});
		
		// Send instructions to the content script
		if (menuInfo.frameId == 0){ //main frame
			browser.tabs.sendMessage(
				currTab.id,
				{"getdetails": imgmsg}
			).catch((err) => {
				console.log('Error in tabs.sendMessage (main tab)', err);
			});
		} else { //need to inject CSS and execute script in this frame first before sending the message
			if (injectedFrames.indexOf(menuInfo.frameId) < 0){
				injectedFrames.push(menuInfo.frameId);
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
						).catch((err) => {
							console.log('Error in tabs.sendMessage (frame)', err);
						});
					}).catch((err) => {
						console.log('Error in tabs.executeScript (frame)', err);
					});
				}).catch((err) => {
					console.log('Error in tabs.insertCSS (frame)', err);
				});
			} else {
				browser.tabs.sendMessage(
					currTab.id,
					{"getdetails": imgmsg},
					{frameId: menuInfo.frameId}
				).catch((err) => {
					console.log('Error in tabs.sendMessage (frame)', err);
				});
			}
		}
	}
});

function navToImage(tabId, urlType, imgUrl, tabUrl, frameUrl){	// [v1.9]
	// Update watchlist for header interception
	var dtNow = Date.now();
	watchlist.unshift({
		id: dtNow,
		url: imgUrl,
		currentSrcUrl: '',
		imgSrcUrl: '',
		fileName: '',
		lastMod: '',
		done: false
	});

	// Compute action parameter
	var urlAction = 'viirviewimage';
	switch (urlType){
		case 'reqnowebp':
			urlAction = 'viirstripwebp';
			break;
		case 'reqasie11':
			urlAction = 'viirasie11';
			break;
	}

	// Compute View Image request URL
	var newUrl = new URL(imgUrl);
	if (newUrl.search.length == 0) newUrl.search = '?' + urlAction + '=' + dtNow;
	else newUrl.search += '&' + urlAction + '=' +  + dtNow;

	// Compute referrer and add to request URL
	var refUrl = new URL((frameUrl) ? frameUrl : tabUrl);
	if (newUrl.protocol == 'http:' && refUrl.protocol == 'https:'){
		// No referrer on downgrade
	} else if (newUrl.origin == refUrl.origin){
		// Same origin: origin+path without search or hash
		newUrl.search += '&viirreferrer=' + encodeURIComponent(refUrl.origin + refUrl.pathname);
	} else {
		// Cross-site: origin only
		newUrl.search += '&viirreferrer=' + encodeURIComponent(refUrl.origin);
	}

	// Navigate in same tab
	browser.tabs.update(
		tabId, 
		{
			url: newUrl.href,
		}
	);
}


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
			oImgInfo.referUrl = oContentInfo.referUrl;
			oImgInfo.currentSrc = oContentInfo.currentSrc;
			oImgInfo.imgSrc = oContentInfo.imgSrc;
			oImgInfo.naturalHeight = oContentInfo.naturalHeight;
			oImgInfo.naturalWidth = oContentInfo.naturalWidth;
			oImgInfo.scaledHeight = oContentInfo.scaledHeight;
			oImgInfo.scaledWidth = oContentInfo.scaledWidth;
			oImgInfo.decodedSize = oContentInfo.decodedSize;
			oImgInfo.transferSize = oContentInfo.transferSize;
			oImgInfo.transferTime = oContentInfo.transferTime;
			oImgInfo.attribJSON = oContentInfo.attribJSON;
			oImgInfo.ahref = oContentInfo.ahref;
			oImgInfo.picsrc = oContentInfo.picsrc;
			oImgInfo.mimeType = oContentInfo.mimeType;
			oImgInfo.fileName = '';
			oImgInfo.lastModified = '';

			// Check for image URL discrepancy and update watchlist item if needed [v1.3]
			if (oImgInfo.currentSrc != oImgInfo.sourceUrl || oImgInfo.imgSrc != oImgInfo.sourceUrl){
				var watchitem = watchlist.find(objRequest => objRequest.id === parseInt(oContentInfo.now));
				watchitem.currentSrcUrl = oImgInfo.currentSrc;
				watchitem.imgSrcUrl = oImgInfo.imgSrc;
			}

			// Finally time to display it
			if (oImgInfo.axn == 'window'){
				// launch popup
				var props = {
					type: 'popup', 
					incognito: request.showinfo.incognito,
					url: '/view-image-info-page.html?request=' + request.showinfo.now + '&pop=true'
				};
				if (oPrefs.popheight != 'auto'){
					props.height = parseInt(oPrefs.popheight);
				}
				if (oPrefs.popwidth != 'auto'){
					props.width = parseInt(oPrefs.popwidth);
				}
				if (oPrefs.poptop != 'auto'){
					props.top = parseInt(oPrefs.poptop);		// not working yet, see bug 1271047
				}
				if (oPrefs.popleft != 'auto'){
					props.left = parseInt(oPrefs.popleft);		// not working yet, see bug 1271047
				}
				var w = browser.windows.create(props);
				w.then((winfo) => {
					oImgInfo.reportingTab = winfo.tabs[0].id;
					if (oPrefs.poptop != 'auto' || oPrefs.popleft != 'auto'){	// set position [v1.8]
						var props = {};
						if (oPrefs.poptop != 'auto'){
							props.top = parseInt(oPrefs.poptop);
						}
						if (oPrefs.popleft != 'auto'){
							props.left = parseInt(oPrefs.popleft);
						}
						browser.windows.update(
							winfo.id,
							props
						);
					}
				});
			} else if (oImgInfo.axn == 'intab'){
				// create tab
				var props = {
					url: '/view-image-info-page.html?request=' + request.showinfo.now + '&pop=false'
				};
				if (oPrefs.tabinback){
					props.active = false;
				}
				var t = browser.tabs.create(props);
				t.then((tinfo) => {
					oImgInfo.reportingTab = tinfo.id;
				});
			} else {
				// Probably 'inpage' so do nothing
			}
		} else { // create a new record TODO
			console.log('now not found!', oContentInfo, pops);
			
		}
	} else if ("unwatch" in request) {
		var indx = watchlist.findIndex(objRequest => objRequest.id === parseInt(request.unwatch));
		if (indx > -1){
			watchlist.splice(indx, 1); 
		}
	} else if ("senddetails" in request) {
		sendResponse({
			renderdata: pops.find(objRequest => objRequest.now === parseInt(request.senddetails))
		});
		return true;
	} else if ("popsizing" in request) { // [v1.5]
		var sizeupdt = request.popsizing;
		if (sizeupdt.popwidth == 'auto'){
			if (oPrefs.popwidth != 'auto') {
				oPrefs.popwidth = 'auto';
				oPrefs.popheight = 'auto';
				oPrefs.poptop = 'auto';
				oPrefs.popleft = 'auto';
			} else {
				return;
			}
		} else {
			oPrefs.popwidth = sizeupdt.popwidth;
			oPrefs.popheight = sizeupdt.popheight;
			oPrefs.poptop = sizeupdt.poptop;
			oPrefs.popleft = sizeupdt.popleft;
		}
		// Write to storage
		browser.storage.local.set(
			{prefs: oPrefs}
		).then(() => {
			// inject changes into all pops array items
			for (var i=0; i<pops.length; i++){
				pops[i].popwidth = oPrefs.popwidth;
				pops[i].popheight = oPrefs.popheight;
				pops[i].poptop = oPrefs.poptop;
				pops[i].popleft = oPrefs.popleft;
			}
		}).catch((err) => {
			console.log('Error on browser.storage.local.set(): ' + err.message);
		});
	} else if ("getprefs" in request) {
		sendResponse({
			pref: oPrefs,
			tabId: sender.tab.id,
			frameId: sender.frameId, 
			incognito: sender.tab.incognito
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
			}).then(() => {
				if (currentStyle != oPrefs.menustyle){
					// Clear current menu definition and rebuild;
					var removing = browser.menus.removeAll();
					removing.then(() => {
						setupMenus();
					});
				}
			}).catch((err) => {console.log('Error retrieving "prefs" from storage: '+err.message);});
		}
	}
}
browser.runtime.onMessage.addListener(handleMessage);

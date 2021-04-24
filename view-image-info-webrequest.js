/* 
  View Image Info Reborn - webRequest Background Script
  Copyright 2021. Jefferson "jscher2000" Scher. License: MPL-2.0.
  webRequest listener to capture/tweak headings on selected image requests
  version 1.0 - MVP
  version 1.2 - bug fixes for stand-alone image pages, cache bypass for overlay
  version 1.3 - bug fixes for missing data
  version 1.5 - add Last-Modified, window/tab options
  version 1.6 - Save As options
  version 1.6.1 - bug fixes
  version 1.7 - Referrer
  version 1.8 - Referrer for preview, popup position option
  version 1.8.1 - Adjust source URL conflict resolution to prefer currentSrc
  version 1.9 - View Image in same tab
*/

/**** Report Headers of Intercepted Responses ****/

function reportHeaders(details) {
	// Only pay attention to requests on the watchlist
	var req = watchlist.find(objRequest => objRequest.url.toLowerCase() === details.url.toLowerCase());
	if (!req) req = watchlist.find(objRequest => objRequest.currentSrcUrl.toLowerCase() === details.url.toLowerCase());
	if (!req) req = watchlist.find(objRequest => objRequest.imgSrcUrl.toLowerCase() === details.url.toLowerCase());
	if (req){
		// Store the Content-Type and Content-Disposition headers if present
		for (let header of details.responseHeaders) {
			switch (header.name.toLowerCase()) {
				case "content-type":
					req.mimeType = header.value;
					break;
				case "content-disposition":
					// check for filename in header
					let filename = null;
					let sections = header.value.split(";");
					for (var i=0; i<sections.length; i++) {
						var parts = sections[i].split("=", 2);
						if (parts[0].trim().toLowerCase().indexOf('filename') === 0) {
							// remove quotes
							filename = parts[1].trim();
							if (filename.startsWith('"')) filename = filename.slice(1);
							if (filename.endsWith('"')) filename = filename.slice(0, -1);
						}
					}
					if (filename.length > 0) req.fileName = filename;
					break;
				case "last-modified":
					req.lastMod = header.value;
					break;
			}
		}
		// Update image info object
		var oImgInfo = pops.find(objRequest => objRequest.now === req.id);
		if (oImgInfo){
			if (req.mimeType.toLowerCase().indexOf('image/') === 0) oImgInfo.mimeType = req.mimeType;
			else oImgInfo.nonImageMimeType = req.mimeType;
			oImgInfo.fileName = req.fileName;
			oImgInfo.lastModified = req.lastMod;

			// Send message to tab
			browser.tabs.sendMessage(
				oImgInfo.reportingTab,
				{"headerdetails": oImgInfo }
			).catch((err) => {
				console.log('Could not sendMessage to tab: ' + oImgInfo.reportingTab);
			});
		}

		// Remove request from watchlist
		req.done = true;
		var indx = watchlist.findIndex(objRequest => objRequest.id === req.id);
		if (indx > -1){
			watchlist.splice(indx, 1); 
		}
	}
}

// Set up read-only listener after extensions have had the chance to modify headers
// (unfortunately not possible to filter by partial match of the hash)
browser.webRequest.onResponseStarted.addListener(
	reportHeaders,
	{
		urls: ["<all_urls>"], 
		types: ["image"]
	},
	["responseHeaders"]
);

/**** Redirect Cache-Bypass Reloads [version 1.2] and Save As Re-Requests [version 1.6] ****/

// URLs to intercept in various event handlers
var wrTasks = {
	onBefSendHead: [],
	modAccept: [],
	modAcceptNoWebp: [],
	modUA: [],
	modReferer: [],
	modNoCacheOnly: [],
	onHeadRecd: []
};

var OBSH_listener, OHR_listener;

function doRedirect(requestDetails){
	var url = new URL(requestDetails.url);
	var orighref = url.href;
	var srch = url.search;
	if (srch.length > 0){
		var searcharray = url.search.slice(1).split('&');
		if (srch.indexOf('viirnow=') > -1){				// For MIME and Last-Modified
			if (searcharray.length == 1){
				url.search = '';
			} else {
				var viirIndex = searcharray.findIndex((element) => element.indexOf('viirnow=') > -1);
				if (viirIndex > -1) {
					searcharray.splice(viirIndex, 1);
					url.search = '?' + searcharray.join('&');
				}
			}
		}

		if (srch.indexOf('viirnocache=') > -1){			// For extension page
			if (searcharray.length == 1){
				url.search = '';
			} else {
				var viirIndex = searcharray.findIndex((element) => element.indexOf('viirnocache=') > -1);
				if (viirIndex > -1) {
					searcharray.splice(viirIndex, 1);
					url.search = '?' + searcharray.join('&');
				}
			}
			if (srch.indexOf('viirreferrer=') > -1){		// Set Referer for preview image
				var refInfo = searcharray.find((element) => element.indexOf('viirreferrer=') > -1);
				if (searcharray.length == 1){
					url.search = '';
				} else {
					var viirIndex = searcharray.findIndex((element) => element.indexOf('viirreferrer=') > -1);
					if (viirIndex > -1) {
						searcharray.splice(viirIndex, 1);
						url.search = '?' + searcharray.join('&');
					}
				}
				var oRef = {
					imgUrl: url.href,
					refUrl: refInfo.split('=')[1]
				};
				wrTasks.modReferer.push(oRef);
				wrTasks.onBefSendHead.push(url.href);		// To modify Referer
			}
			wrTasks.modNoCacheOnly.push(url.href);		// To modify Cache-Control
			wrTasks.onHeadRecd.push(url.href);			// To modify Cache-Control
		}

		if (srch.indexOf('viirviewimage=') > -1){			// Use standard image Accept [v1.9]
			if (searcharray.length == 1){
				url.search = '';
			} else {
				var viirIndex = searcharray.findIndex((element) => element.indexOf('viirviewimage=') > -1);
				if (viirIndex > -1) {
					searcharray.splice(viirIndex, 1);
					url.search = '?' + searcharray.join('&');
				}
			}
			if (srch.indexOf('viirreferrer=') > -1){		// Set Referer for view image in same tab
				var refInfo = searcharray.find((element) => element.indexOf('viirreferrer=') > -1);
				if (searcharray.length == 1){
					url.search = '';
				} else {
					var viirIndex = searcharray.findIndex((element) => element.indexOf('viirreferrer=') > -1);
					if (viirIndex > -1) {
						searcharray.splice(viirIndex, 1);
						url.search = '?' + searcharray.join('&');
					}
				}
				var oRef = {
					imgUrl: url.href,
					refUrl: refInfo.split('=')[1]
				};
				wrTasks.modReferer.push(oRef);
			}
			wrTasks.onBefSendHead.push(url.href);		// To modify Accept header / Referer if applicable
			wrTasks.modAccept.push(url.href);			// To modify Accept header / Referer if applicable
		}

		if (srch.indexOf('viirreferrer=') > -1 && srch.indexOf('viirnocache=') < 0 && srch.indexOf('viirviewimage=') < 0){	// Set Referer (this supplements either modAccept or modUA)
			var refInfo = searcharray.find((element) => element.indexOf('viirreferrer=') > -1);
			var oRef = {
				imgUrl: null,
				refUrl: refInfo.split('=')[1]
			};

			if (searcharray.length == 1){
				url.search = '';
			} else {
				var viirIndex = searcharray.findIndex((element) => element.indexOf('viirreferrer=') > -1);
				if (viirIndex > -1) {
					searcharray.splice(viirIndex, 1);
					url.search = '?' + searcharray.join('&');
				}
			}
		}

		if (srch.indexOf('viirattach=') > -1){			// Use standard image Accept, add Content-Disposition: attachment
			if (searcharray.length == 1){
				url.search = '';
			} else {
				var viirIndex = searcharray.findIndex((element) => element.indexOf('viirattach=') > -1);
				if (viirIndex > -1) {
					searcharray.splice(viirIndex, 1);
					url.search = '?' + searcharray.join('&');
				}
			}
			wrTasks.onBefSendHead.push(url.href);		// To modify Accept header
			wrTasks.modAccept.push(url.href);			// To modify Accept header
			wrTasks.onHeadRecd.push(url.href);			// To modify Content-Disposition to attachment
		}

		if (srch.indexOf('viirstripwebp=') > -1){		// Use image Accept without webp, add Content-Disposition: attachment
			if (searcharray.length == 1){
				url.search = '';
			} else {
				var viirIndex = searcharray.findIndex((element) => element.indexOf('viirstripwebp=') > -1);
				if (viirIndex > -1) {
					searcharray.splice(viirIndex, 1);
					url.search = '?' + searcharray.join('&');
				}
			}
			wrTasks.onBefSendHead.push(url.href);		// To modify Accept header
			wrTasks.modAcceptNoWebp.push(url.href);		// To modify Accept header
			wrTasks.onHeadRecd.push(url.href);			// To modify Content-Disposition to attachment
			if (oRef){
				oRef.imgUrl = url.href;
				wrTasks.modReferer.push(oRef);
			}
		}

		if (srch.indexOf('viirasie11=') > -1){			// Use image Accept without webp, IE 11 UA, Content-Disposition: attachment
			if (searcharray.length == 1){
				url.search = '';
			} else {
				var viirIndex = searcharray.findIndex((element) => element.indexOf('viirasie11=') > -1);
				if (viirIndex > -1) {
					searcharray.splice(viirIndex, 1);
					url.search = '?' + searcharray.join('&');
				}
			}
			wrTasks.onBefSendHead.push(url.href);		// To modify Accept and User-Agent header
			wrTasks.modAcceptNoWebp.push(url.href);		// To modify Accept header (to better match IE)
			wrTasks.modUA.push(url.href);				// To modify User-Agent header
			wrTasks.onHeadRecd.push(url.href);			// To modify Content-Disposition to attachment
			if (oRef){
				oRef.imgUrl = url.href;
				wrTasks.modReferer.push(oRef);
			}
		}
			
		// Remove and re-add event listeners
		browser.webRequest.onBeforeSendHeaders.removeListener(modReqHeaders);
		if (wrTasks.onBefSendHead.length > 0){
			OBSH_listener = browser.webRequest.onBeforeSendHeaders.addListener(
				modReqHeaders,
				{
					urls: wrTasks.onBefSendHead,
					types: ["image", "main_frame"]
				},
				["blocking", "requestHeaders"]
			);
		}

		browser.webRequest.onHeadersReceived.removeListener(modConDisp);
		if (wrTasks.onHeadRecd.length > 0){
			OHR_listener = browser.webRequest.onHeadersReceived.addListener(
				modConDisp,
				{
					urls: wrTasks.onHeadRecd,
					types: ["image", "main_frame"]
				},
				["blocking", "responseHeaders"]
			);
		}

		if (url.href != orighref) {
			return {
				redirectUrl: url.href
			};
		}
	}
}

// Set up listener to clean the viir parameter from the url so it doesn't hit the server
var urlpatterns = [
	"*://*/*viirnow=*",
	"*://*/*viirnocache=*",
	"*://*/*viirattach=*",
	"*://*/*viirstripwebp=*",
	"*://*/*viirasie11=*",
	"*://*/*viirviewimage=*"
];

browser.webRequest.onBeforeRequest.addListener(
	doRedirect,
	{
		urls: urlpatterns, 
		types: ["image", "main_frame"] 
	},
	["blocking"]
);

/**** Clean Accept Header and Modify User-Agent for Selected Requests [version 1.6] ****/

function modReqHeaders(details){
	// Accept header - default for inline image requests (instead of main frame requests)
	var taskIndex = wrTasks.modAccept.indexOf(details.url);
	if (taskIndex > -1){
		// Find Accept header and use old-style image Accept header
		for (let header of details.requestHeaders) {
			if (header.name.toLowerCase() === 'accept'){
				header.value = 'image/webp,*/*';
				break;
			}
		}
		// Purge from modAccept list
		wrTasks.modAccept.splice(taskIndex, 1);
	}

	// Accept header - inline image request minus image/webp
	var taskIndex = wrTasks.modAcceptNoWebp.indexOf(details.url);
	if (taskIndex > -1){
		// Find Accept header and use old-style image Accept header
		for (let header of details.requestHeaders) {
			if (header.name.toLowerCase() === 'accept'){
				header.value = '*/*';
				break;
			}
		}
		// Purge from modAcceptNoWebp list
		wrTasks.modAcceptNoWebp.splice(taskIndex, 1);
	}
	// User-Agent
	taskIndex = wrTasks.modUA.indexOf(details.url);
	if (taskIndex > -1){
		// Find User-Agent and modify to IE 11
		for (let header of details.requestHeaders) {
			if (header.name.toLowerCase() === 'user-agent'){
				header.value = 'Mozilla/5.0 (Windows NT 10.0; WOW64; Trident/7.0; rv:11.0) like Gecko';
				break;
			}
		}
		// Purge from modUA list
		wrTasks.modUA.splice(taskIndex, 1);
	}
	// Referrer
	taskIndex = wrTasks.modReferer.findIndex(oTask => oTask.imgUrl === details.url);
	if (taskIndex > -1){
		// Replace or Add Referer
		let refHeader;
		for (let header of details.requestHeaders) {
			if (header.name.toLowerCase() === 'referer'){
				refHeader = header;
				break;
			}
		}
		if (refHeader) {
			// Switch referrer
			refHeader.value = decodeURIComponent(wrTasks.modReferer[taskIndex].refUrl);
		} else {
			// Create a new header
			details.requestHeaders.push({
				name: 'Referer',
				value: decodeURIComponent(wrTasks.modReferer[taskIndex].refUrl)
			});
		}
		// Purge from modReferer list
		wrTasks.modReferer.splice(taskIndex, 1);
	}

	// Purge from event tasks
	taskIndex = wrTasks.onBefSendHead.indexOf(details.url);
	if (taskIndex > -1) wrTasks.onBefSendHead.splice(taskIndex, 1);

	// Dispatch headers, we're done
	return { requestHeaders: details.requestHeaders };
}

/**** Set Attachment Disposition for Save As Re-Requests [version 1.6] ****/

function modConDisp(details) {
	// Content-Disposition and Cache-Control headers
	var taskIndex = wrTasks.onHeadRecd.indexOf(details.url);
	if (taskIndex > -1){
		// Cache-Control only
		var noCacheIndex = wrTasks.modNoCacheOnly.indexOf(details.url);
		if (noCacheIndex > -1){
			// extract the Cache-Control header if present
			let ccHeader;
			for (let header of details.responseHeaders) {
				switch (header.name.toLowerCase()) {
					case "cache-control":
						ccHeader = header;
						break;
				}
			}
			// update the Cache-Control header
			if (ccHeader){
				ccHeader.value = 'no-store';
			} else {
				// Create a new header
				details.responseHeaders.push({
					name: 'cache-control',
					value: 'no-store'
				});
			}
			
			// Purge from event tasks
			wrTasks.modNoCacheOnly.splice(noCacheIndex, 1);

		} else {
			// find the Content-Disposition header if present
			let contentDispositionHeader;
			for (let header of details.responseHeaders) {
				switch (header.name.toLowerCase()) {
					case "content-disposition":
						contentDispositionHeader = header;
						break;
				}
			}
			if (contentDispositionHeader) {
				// Switch inline to attachment
				contentDispositionHeader.value = contentDispositionHeader.value.replace('inline', 'attachment');
			} else {
				// Create a CD header
				details.responseHeaders.push({
					name: 'content-disposition',
					value: 'attachment'
				});
			}
		}

		// Purge from event tasks
		wrTasks.onHeadRecd.splice(taskIndex, 1);
	}

	// Dispatch headers, we're done
	return { responseHeaders: details.responseHeaders };
}

/* 
  View Image Info Reborn - webRequest Background Script
  Copyright 2021. Jefferson "jscher2000" Scher. License: MPL-2.0.
  webRequest listener to capture headings on selected image requests
  version 1.0 - MVP
  version 1.2 - bug fixes for stand-alone image pages, cache bypass for overlay
  version 1.3 - bug fixes for missing data
  version 1.5 - add Last-Modified, window/tab options
  version 1.6 - Save As options
*/

/**** Report Headers of Intercepted Responses ****/

function reportHeaders(details) {
	// Only pay attention to requests on the watchlist
	var req = watchlist.find(objRequest => objRequest.url.toLowerCase() === details.url.toLowerCase());
	if (!req) req = watchlist.find(objRequest => objRequest.contentSrcUrl.toLowerCase() === details.url.toLowerCase());
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
	modUA: [],
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
		if (srch.indexOf('viirattach=') > -1){		// Just add Content-Disposition: attachment
			if (searcharray.length == 1){
				url.search = '';
			} else {
				var viirIndex = searcharray.findIndex((element) => element.indexOf('viirattach=') > -1);
				if (viirIndex > -1) {
					searcharray.splice(viirIndex, 1);
					url.search = '?' + searcharray.join('&');
				}
			}
			wrTasks.onHeadRecd.push(url.href);		// To modify Content-Disposition to attachment
		}
		if (srch.indexOf('viirstripwebp=') > -1){		// To remove image/webp from Accept header
			if (searcharray.length == 1){
				url.search = '';
			} else {
				var viirIndex = searcharray.findIndex((element) => element.indexOf('viirstripwebp=') > -1);
				if (viirIndex > -1) {
					searcharray.splice(viirIndex, 1);
					url.search = '?' + searcharray.join('&');
				}
			}
			wrTasks.onBefSendHead.push(url.href);	// To modify Accept header
			wrTasks.modAccept.push(url.href);		// To modify Accept header
			wrTasks.onHeadRecd.push(url.href);		// To modify Content-Disposition to attachment
		}
		if (srch.indexOf('viirasie11=') > -1){			// To request "as" Internet Explorer 11
			if (searcharray.length == 1){
				url.search = '';
			} else {
				var viirIndex = searcharray.findIndex((element) => element.indexOf('viirasie11=') > -1);
				if (viirIndex > -1) {
					searcharray.splice(viirIndex, 1);
					url.search = '?' + searcharray.join('&');
				}
			}
			wrTasks.onBefSendHead.push(url.href);	// To modify Accept and User-Agent header
			wrTasks.modAccept.push(url.href);		// To modify Accept header (to better match IE)
			wrTasks.modUA.push(url.href);			// To modify User-Agent header
			wrTasks.onHeadRecd.push(url.href);		// To modify Content-Disposition to attachment
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
	"*://*/*viirattach=*",
	"*://*/*viirstripwebp=*",
	"*://*/*viirasie11=*"
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
	// Accept header
	var taskIndex = wrTasks.modAccept.indexOf(details.url);
	if (taskIndex > -1){
		// Find Accept header and strip image/webp
		for (let header of details.requestHeaders) {
			if (header.name.toLowerCase() === 'accept'){
				let pos = header.value.toLowerCase().indexOf('image/webp,');
				if (pos > -1){ // remove this content type with trailing comma
					header.value = header.value.slice(0, pos) + header.value.slice(pos + 11);
				}
				pos = header.value.toLowerCase().indexOf('image/webp');
				if (pos > -1){ // remove this content type
					header.value = header.value.slice(0, pos) + header.value.slice(pos + 10);
				}
				pos = header.value.indexOf(',,');
				if (pos > -1){ // clean up any double comma
					header.value = header.value.slice(0, pos) + header.value.slice(pos + 1);
				}
				break;
			}
		}
		// Purge from modAccept list
		wrTasks.modAccept.splice(taskIndex, 1);
	}
	// User-Agent
	taskIndex = wrTasks.modUA.indexOf(details.url);
	if (taskIndex > -1){
		// Find User-Agent and modify to IE 11
		for (header of details.requestHeaders) {
			if (header.name.toLowerCase() === 'user-agent'){
				header.value = 'Mozilla/5.0 (Windows NT 10.0; WOW64; Trident/7.0; rv:11.0) like Gecko';
				break;
			}
		}
		// Purge from modAccept list
		wrTasks.modUA.splice(taskIndex, 1);
	}
	// Purge from event tasks
	taskIndex = wrTasks.onBefSendHead.indexOf(details.url);
	if (taskIndex > -1) wrTasks.onBefSendHead.splice(taskIndex, 1);

	// Dispatch headers, we're done
	return { requestHeaders: details.requestHeaders };
}

/**** Set Attachment Disposition for Save As Re-Requests [version 1.6] ****/

function modConDisp(details) {
	// Content-Disposition header
	var taskIndex = wrTasks.onHeadRecd.indexOf(details.url);
	if (taskIndex > -1){
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

		// Purge from event tasks
		wrTasks.onHeadRecd.splice(taskIndex, 1);
	}
	
	// Dispatch headers, we're done
	return { responseHeaders: details.responseHeaders };
}

/* 
  View Image Info Reborn - webRequest Background Script
  Copyright 2021. Jefferson "jscher2000" Scher. License: MPL-2.0.
  webRequest listener to capture headings on selected image requests
  version 1.0 - MVP
  version 1.2 - bug fixes for stand-alone image pages, cache bypass for overlay
*/

/**** Report Headers of Intercepted Responses ****/

function reportHeaders(details) {
	// Only pay attention to requests on the watchlist
	var req = watchlist.find(objRequest => objRequest.url.toLowerCase() === details.url.toLowerCase());
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
					let sections = contentDispositionHeader.value.split(";");
					for (var i=0; i<sections.length; i++) {
						var parts = sections[i].split("=", 2);
						if (parts[0].trim().toLowerCase().indexOf('filename') === 0) {
							// remove quotes
							filename = parts[1].trim();
							if (filename.endsWith('"')) filename = filename.slice(0, -1);
						}
					}
					if (filename.length > 0) req.fileName = filename;
					else req.fileName = null;
					break;
			}
		}
		// Update image info object
		var oImgInfo = pops.find(objRequest => objRequest.now === req.id);
		if (oImgInfo){
			if (req.mimeType.toLowerCase().indexOf('image/') === 0) oImgInfo.mimeType = req.mimeType;
			else oImgInfo.nonImageMimeType = req.mimeType;
			oImgInfo.fileName = req.fileName;
		}

		// Send message to tab
		browser.tabs.sendMessage(
			oImgInfo.reportingTab,
			{"headerdetails": oImgInfo }
		);

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
	{ urls: ["<all_urls>"], types: ["image"] },
	["responseHeaders"]
);

/**** Redirect Cache-Bypass Reloads [version 1.2] ****/

function doRedirect(requestDetails){
	var url = new URL(requestDetails.url);
	var orighref = url.href;
	if (url.search.length > 0){
		var searcharray = url.search.slice(1).split('&');
		if (searcharray.length == 1){
			url.search = '';
		} else {
			var viirIndex = searcharray.findIndex((element) => element.indexOf('viirnow=') > -1);
			if (viirIndex > -1) {
				searcharray.splice(viirIndex, 1);
				url.search = '?' + searcharray.join('&');
			}
		}
		if (url.href != orighref) {
			return {
				redirectUrl: url.href
			};
		}
	}
}

// Set up listener to clean the viirnow url at the earliest opportunity
var urlpatterns = [
	"*://*/*viirnow=*"
];
browser.webRequest.onBeforeRequest.addListener(
	doRedirect,
	{ urls: urlpatterns, types: ["image"] },
	["blocking"]
);

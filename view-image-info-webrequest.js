/* 
  View Image Info Reborn
  Copyright 2021. Jefferson "jscher2000" Scher. License: MPL-2.0.
  webRequest listener to capture headings on selected image requests
  version 1.0 - MVP
*/

/**** Report Headers of Intercepted Responses ****/
function reportHeaders(details) {
	// Only pay attention to requests on the watchlist
	var req = watchlist.find(objRequest => objRequest.url.toLowerCase() === details.url.toLowerCase());
	if (req){
		if (req.done == true) return; // TODO: figure out why deleting it didn't work? 

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

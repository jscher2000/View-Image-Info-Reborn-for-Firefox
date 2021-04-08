/* 
  View Image Info Reborn - Page Script
  Copyright 2021. Jefferson "jscher2000" Scher. License: MPL-2.0.
  Script to populate image data into new window/tab
  version 1.0 - MVP
  version 1.2 - bug fixes, image error handling
  version 1.3 - bug fixes for missing data
  version 1.4 - bug fixes for missing data
*/

let details = {};

// Request data from background
var params = new URLSearchParams(document.location.search.substring(1));
var timenow = params.get('request');
if (timenow){
	browser.runtime.sendMessage({
		senddetails: timenow
	}).then((response) => {
		details = response.renderdata;
		// Set color scheme and font size
		document.body.setAttribute('colorscheme', details.colorscheme);
		document.body.setAttribute('style', '--body-size: ' + details.fontsize);
		if (details.imgSrc != details.sourceUrl){
			document.title = details.imgSrc;
		} else {
			document.title = details.sourceUrl;
		}
		// Populate data into the page
		document.getElementById('localTime').textContent = new Date(details.now).toLocaleString();
		document.getElementById('pageTitle').textContent = details.pageTitle;
		document.getElementById('pageUrl').textContent = details.pageUrl;
		if (details.imgSrc != details.sourceUrl){
			document.getElementById('sourceUrl').textContent = details.imgSrc;
		} else {
			document.getElementById('sourceUrl').textContent = details.sourceUrl;
		}
		if (details.fileName && document.getElementById('fileName').textContent == ''){
			document.getElementById('fileName').textContent = details.fileName;
			document.getElementById('fname').style.display = '';
		} else if (document.getElementById('fileName').textContent == ''){
			document.getElementById('fname').style.display = 'none';
		}
		if (details.mimeType){
			document.getElementById('mimeType').textContent = details.mimeType.slice(details.mimeType.indexOf('/')+1).toUpperCase();
		} else {
			// Try again in case it's a timing problem
			window.setTimeout(getMime, 300);
		}
		document.getElementById('naturalWidth').textContent = details.naturalWidth + 'px';
		document.getElementById('naturalHeight').textContent = details.naturalHeight + 'px';
		if (details.naturalWidth == details.scaledWidth && details.naturalHeight == details.scaledHeight){
			document.getElementById('scaled').style.display = 'none';
		} else {
			document.getElementById('scaledWidth').textContent = details.scaledWidth + 'px';
			document.getElementById('scaledHeight').textContent = details.scaledHeight + 'px';
		}
		document.getElementById('decodedSize').textContent = (+(Math.round(details.decodedSize/1024 + 'e+2')  + 'e-2')) + ' KB (' + details.decodedSize + ')';
		if (details.altText){
			document.getElementById('altText').textContent = details.altText;
		} else {
			document.getElementById('alt').style.display = 'none';
		}
		if (details.titleText){
			document.getElementById('titleText').textContent = details.titleText;
		} else {
			document.getElementById('title').style.display = 'none';
		}

		// Load the image
		var img = document.getElementById('preview');
		img.onerror = function(event){
			document.querySelector('#oops span').textContent = 'Image did not load, possibly due to lack of credentials or referring host name.';
			document.getElementById('oops').style.display = 'block';
		};
		img.onload = function(event){
			// fill in missing size info when that happens (url's sometimes vary) [v1.4]
			if (!details.decodedSize && window.performance){
				var resos = performance.getEntriesByType('resource');
				var perfrec = resos.find(obj => obj.name.indexOf(details.sourceUrl) > -1);
				if (!perfrec) perfrec = resos.find(obj => obj.name.indexOf(moredetails.currentSrc) > -1);
				if (!perfrec) perfrec = resos.find(obj => obj.name.indexOf(details.imgSrc) > -1);
				if (perfrec && perfrec.decodedBodySize > 0){
					details.decodedSize = perfrec.decodedBodySize;
					document.getElementById('decodedSize').textContent = (+(Math.round(details.decodedSize/1024 + 'e+2')  + 'e-2')) + ' KB (' + details.decodedSize + ')';
				}
			}
		};
		if (details.imgSrc != details.sourceUrl){
			var url = new URL(details.imgSrc);
		} else {
			url = new URL(details.sourceUrl);
		}
		if (url.search.length == 0) url.search = '?viirnow=' + details.now;
		else url.search += '&viirnow=' + details.now;
		img.src = url.href;
	});
} else {
	alert('Request number not set on URL?');
}

function getMime(){
	browser.runtime.sendMessage({
		senddetails: timenow
	}).then((response) => {
		if (details.mimeType){
			document.getElementById('mimeType').textContent = details.mimeType.slice(details.mimeType.indexOf('/')+1).toUpperCase();
		}
	});
}

// Event handlers
document.getElementById('options').addEventListener('click', function(evt){
	browser.runtime.openOptionsPage();
}, false);
document.getElementById('btnprint').addEventListener('click', function(evt){
	window.print();
	evt.target.blur();
}, false);
document.getElementById('btnclose').addEventListener('click', function(evt){
	evt.target.parentNode.style.display = '';
}, false);

/**** Handle Requests from Background script ****/
let moredetails = {};
function handleMessage(request, sender, sendResponse){
	// Update displayed info
	if ('headerdetails' in request){
		var moredetails = request.headerdetails;
		if (moredetails.mimeType){
			document.getElementById('mimeType').textContent = moredetails.mimeType.slice(moredetails.mimeType.indexOf('/')+1).toUpperCase();
		}
		if (moredetails.fileName && document.getElementById('fileName').textContent == ''){
			document.getElementById('fileName').textContent = moredetails.fileName;
			document.getElementById('fname').style.display = '';
		} else if (document.getElementById('fileName').textContent == ''){
			document.getElementById('fname').style.display = 'none';
		}
	}
}
browser.runtime.onMessage.addListener(handleMessage);
/* 
  View Image Info Reborn - Info Page Script
  Copyright 2021. Jefferson "jscher2000" Scher. License: MPL-2.0.
  Script to populate image data into new window/tab
  version 1.0 - MVP
  version 1.2 - bug fixes, image error handling
  version 1.3 - bug fixes for missing data
  version 1.4 - bug fixes for missing data
  version 1.5 - add Last-Modified, window/tab options
  version 1.6 - Save As options
  version 1.6.1 - bug fixes
  version 1.7 - Referrer
  version 1.7.1 - bug fix
  version 1.8 - Referrer for preview, popup position option
*/

let details = {};

// Request data from background
var params = new URLSearchParams(document.location.search.substring(1));
var timenow = params.get('request');
if (timenow){
	browser.runtime.sendMessage({
		senddetails: timenow
	}).then((response) => {
		var st;
		details = response.renderdata;
		// Set color scheme and font size
		document.body.setAttribute('colorscheme', details.colorscheme);
		document.body.setAttribute('style', '--body-size: ' + details.fontsize);
		if (details.imgSrc != details.sourceUrl && details.imgSrc != '' && details.imgSrc != details.pageUrl){
			document.title = details.imgSrc;
		} else {
			document.title = details.sourceUrl;
		}
		// Update layout
		var main = document.querySelector('main');
		if (details.previewstyle == 'classic') {
			main.className = details.previewstyle;
			main.appendChild(document.getElementById('previewdiv'));
		}
		// Populate data into the page
		if (details.imgSrc != details.sourceUrl && details.imgSrc != '' && details.imgSrc != details.pageUrl){
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
			document.getElementById('defaultmime').textContent = '(' + document.getElementById('mimeType').textContent + ')';
		} else {
			// Try again in case it's a timing problem
			st = window.setTimeout(getMime, 300);
		}
		document.getElementById('naturalWidth').textContent = details.naturalWidth + 'px';
		document.getElementById('naturalHeight').textContent = details.naturalHeight + 'px';
		if (details.naturalWidth == details.scaledWidth && details.naturalHeight == details.scaledHeight){
			document.getElementById('scaled').style.display = 'none';
		} else {
			document.getElementById('scaledWidth').textContent = details.scaledWidth + 'px';
			document.getElementById('scaledHeight').textContent = details.scaledHeight + 'px';
		}
		if (details.decodedSize){
			document.getElementById('decodedSize').textContent = (+(Math.round(details.decodedSize/1024 + 'e+2')  + 'e-2')).toLocaleString() + ' KB (' + details.decodedSize.toLocaleString() + ')';
		}
		if (details.lastModified && details.lastModified.length > 0){
			document.getElementById('lastMod').textContent = details.lastModified;
		}

		// Build attributes table rows [v1.8]
		var arrAtt = JSON.parse(details.attribJSON);
		// Clone and populate templated row
 		var newTR = document.getElementById('new2cellrow'), clone, cells, dest = document.getElementById('tbattributes');
		for (var j=0; j<arrAtt.length; j++){
			clone = document.importNode(new2cellrow.content, true);
			cells = clone.querySelectorAll('tr>th, tr>td');
			cells[0].textContent = arrAtt[j].attrname;
			cells[1].textContent = '"' + arrAtt[j].attrvalue + '"';
			dest.appendChild(clone);
		}
		
		// Populate context table
		document.getElementById('pageTitle').textContent = details.pageTitle;
		var refHref = details.pageUrl;
		if (details.pageUrl === details.imgSrc){
			document.getElementById('pageUrl').textContent = '(Stand Alone)';
		} else {
			document.getElementById('pageUrl').textContent = details.pageUrl;
		}
		if (details.referUrl && details.referUrl.length > 0){
			document.getElementById('referrer').textContent = details.referUrl;
			refHref = details.referUrl;
		} else {
			document.getElementById('refUrl').style.display = 'none';
		}
		if (details.ahref && details.ahref.length > 0){
			document.getElementById('ahref').textContent = details.ahref;
		} else {
			document.getElementById('linkhref').style.display = 'none';
		}
		var dtNow = new Date(details.now);
		document.getElementById('localTime').textContent = dtNow.toDateString() + ' ' + dtNow.toLocaleTimeString();

		// Load the image
		var img = document.getElementById('preview');
		img.onerror = function(event){
			document.querySelector('#oops span').textContent = 'Image did not load, possibly due to lack of credentials or missing referrer.';
			document.getElementById('oops').style.display = 'block';
			document.getElementById('previewtools').style.display = 'inline-block';
		};
		img.onload = function(event){
			// remove height and width attributes
			var img = event.target;
			img.removeAttribute('height');
			img.removeAttribute('width');
			// fill in missing size info when that happens (url's sometimes vary) [v1.4]
			if (!details.decodedSize && window.performance){
				var resos = performance.getEntriesByType('resource');
				var perfrec = resos.find(obj => obj.name.indexOf(details.sourceUrl) > -1);
				if (!perfrec) perfrec = resos.find(obj => obj.name.indexOf(moredetails.currentSrc) > -1);
				if (!perfrec) perfrec = resos.find(obj => obj.name.indexOf(details.imgSrc) > -1);
				if (perfrec && perfrec.decodedBodySize > 0){
					details.decodedSize = perfrec.decodedBodySize;
					document.getElementById('decodedSize').textContent = (+(Math.round(details.decodedSize/1024 + 'e+2')  + 'e-2')).toLocaleString() + ' KB (' + details.decodedSize.toLocaleString() + ')';
				}
			}
			// check zoom-ability [v1.8]
			if (img.height != img.naturalHeight && details.previewstyle == 'topthumb') img.className = 'shrinkToFit';
			else if(img.height != img.naturalHeight && details.previewstyle == 'topfitw') img.className = 'fitw';
		};
		if (details.imgSrc != details.sourceUrl && details.imgSrc != '' && details.imgSrc != details.pageUrl){
			var url = new URL(details.imgSrc);
		} else {
			url = new URL(details.sourceUrl);
		}
		if (url.search.length == 0) url.search = '?viirnocache=' + details.now;
		else url.search += '&viirnocache=' + details.now;
		img.src = url.href;
		
		// Create Save as Request Links
		document.querySelector('#saveasserved a[href]').href = url.href.replace('viirnocache', 'viirattach');
		document.querySelector('#saveasnoaccept a[href]').href = url.href.replace('viirnocache', 'viirstripwebp');
		document.querySelector('#saveasie11 a[href]').href = url.href.replace('viirnocache', 'viirasie11');
		
		// Update Referrer Form Options [v1.7]
		var ref = new URL(refHref);
		var lbl = document.querySelector('#referForm input[value="origin-only"]').labels[0];
		lbl.setAttribute('title', lbl.title.replace('_ORIGIN_', ref.origin));
		lbl = document.querySelector('#referForm input[value="origin-path"]').labels[0];
		lbl.setAttribute('title', lbl.title.replace('_ORIGINPATH_', ref.origin + ref.pathname));
	});
} else {
	alert('Request number not set on URL?');
}
var popup = params.get('pop');
if (popup != 'true') document.getElementById('showresize').style.display = 'none';

function getMime(){
	browser.runtime.sendMessage({
		senddetails: timenow
	}).then((response) => {
		if (details.mimeType){
			document.getElementById('mimeType').textContent = details.mimeType.slice(details.mimeType.indexOf('/')+1).toUpperCase();
			document.getElementById('defaultmime').textContent = '(' + document.getElementById('mimeType').textContent + ')';
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
document.getElementById('preview').addEventListener('click', function(evt){
	var img = evt.target;
	if (img.className == 'shrinkToFit') img.className = 'fitw';
	else if (img.className == 'fitw') img.className = 'shrinkToFit';
}, false);


// Popup window sizing [v1.5] [position v1.8]
function updateWH(evt){
	document.getElementById('currwidth').textContent = window.outerWidth + 'px';
	document.getElementById('currheight').textContent = window.outerHeight + 'px';
	document.getElementById('currleft').textContent = window.screenX + 'px';
	document.getElementById('currtop').textContent = window.screenY + 'px';
}
function updateLT(evt){
	document.getElementById('currleft').textContent = window.screenX + 'px';
	document.getElementById('currtop').textContent = window.screenY + 'px';
}

var poscheck;
document.getElementById('showresize').addEventListener('click', function(evt){
	updateWH();
	var frm = document.getElementById('popsizer');
	if (details.popwidth == 'auto'){
		frm.radSizing.value = 'auto';
		frm.custposition.checked = false;
	} else {
		frm.radSizing.value = 'capture';
		if (details.popleft != 'auto'){
			frm.custposition.checked = true;
		} else {
			frm.custposition.checked = false;
		}
	}
	frm.style.display = 'block';
	window.addEventListener('resize', updateWH, false);
	poscheck = window.setInterval(updateLT, 200);
}, false);

document.getElementById('btnSave').addEventListener('click', function(evt){
	// Remove the resize event handler and interval
	window.removeEventListener('resize', updateWH, false);
	window.clearInterval(poscheck);
	// Update image details and build updater object
	var frm = document.getElementById('popsizer');
	if (frm.radSizing.value == 'auto'){
		details.popwidth = 'auto';
		details.popheight = 'auto';
		var sizeupdate = {
			popwidth: 'auto',	// width for popup window
			popheight: 'auto',	// height for popup window
			poptop: 'auto',		// top for popup window
			popleft: 'auto'		// left for popup window
		}
	} else {
		details.popwidth = window.outerWidth + 'px';
		details.popheight = window.outerHeight + 'px';
		var sizeupdate = {
			popwidth: details.popwidth,		// width for popup window
			popheight: details.popheight	// height for popup window
		}
		if (frm.custposition.checked == true){
			details.poptop = window.screenY + 'px';
			details.popleft = window.screenX + 'px';
		} else {
			details.poptop = 'auto';
			details.popleft = 'auto';
		}
		var sizeupdate = {
			popwidth: details.popwidth,		// width for popup window
			popheight: details.popheight,	// height for popup window
			poptop: details.poptop,			// top for popup window
			popleft: details.popleft		// left for popup window
		}
	}
	// Send message to background to update storage
	browser.runtime.sendMessage({
		popsizing: sizeupdate
	}).catch((err) => {
		document.querySelector('#oops span').textContent = 'Error updating storage: ' + err.message;
		document.getElementById('oops').style.display = 'block';
	});
	// Close the overlay
	document.getElementById('popsizer').style.display = '';
}, false);

document.getElementById('btnCancel').addEventListener('click', function(evt){
	// Remove the resize event handler
	window.removeEventListener('resize', updateWH, false);
	// Close the overlay
	document.getElementById('popsizer').style.display = '';
}, false);

// Save As menu / Image Conversions [v1.6]
function makeBlobDownload(tgtLink, fmt){
	// Create download filename
	var fname = document.getElementById('fileName').textContent;
	var img = document.getElementById('preview');
	var qual = 0.92;
	if (fname.length == 0){
		var path = new URL(img.src).pathname;
		if (path.slice(path.length - 1) == '/') path = path.slice(0, path.length - 1);
		fname = path.slice(path.lastIndexOf('/') + 1);
	}
	if (fmt == 'image/jpeg'){
		fname = fname.replace(/\.webp/i, '.jpg').replace(/\.png/i, '.jpg').replace(/\.gif/i, '.jpg');
		if (fname.slice(-4) != '.jpg') fname += '.jpg';
	} else if (fmt == 'image/png'){
		fname = fname.replace(/\.webp/i, '.png').replace(/\.jpg/i, '.png').replace(/\.gif/i, '.png');
		if (fname.slice(-4) != '.png') fname += '.png';
	}
	tgtLink.setAttribute('download', fname);
	// Create canvas
	var canv = document.createElement('canvas');
	canv.width = img.naturalWidth;
	canv.height = img.naturalHeight;
	var ctx = canv.getContext('2d');
	if (fmt == 'image/jpeg'){
		// Match the background color (fix "white" to avoid transparency)
		var b = window.getComputedStyle(img).getPropertyValue('background-color');
		if (b === 'rgba(0, 0, 0, 0)') b = '#fff';
		ctx.fillStyle = b;
		ctx.fillRect(0, 0, canv.width, canv.height);
	}
	// Then add the image and update the link
	try {
		ctx.drawImage(img, 0, 0);
		canv.toBlob((blob) => {
			tgtLink.href = URL.createObjectURL(blob);
			tgtLink.parentNode.style.display = '';
		}, fmt, qual);
	} catch(err){
		tgtLink.parentNode.style.display = 'none';
	}
}

document.getElementById('btnsaveas').addEventListener('click', function(evt){
	var btn = evt.target;
	if (btn.getAttribute('state') == 'closed'){
		btn.setAttribute('state', 'open');
		document.getElementById('saveaslist').style.display = 'block';
		if (document.querySelector('#saveaspng a').getAttribute('href') == '') makeBlobDownload(document.querySelector('#saveaspng a'), 'image/png');
		if (document.querySelector('#saveasjpg a').getAttribute('href') == '') makeBlobDownload(document.querySelector('#saveasjpg a'), 'image/jpeg');
	} else {
		btn.setAttribute('state', 'closed');
		document.getElementById('saveaslist').style.display = '';
	}
	btn.blur();
}, false);

// Referrer options [v1.7]
var referPolicyButtons = document.getElementsByClassName('btnRefer');
for (var i=0; i<referPolicyButtons.length; i++){
	referPolicyButtons[i].addEventListener('click', function(evt){
		// do not send this client to the link
		evt.preventDefault();
		evt.stopPropagation();
		// show or hide form
		var frm = document.getElementById('referForm');
		if (frm.style.display == 'block' && (evt.target.closest('li') == frm.closest('li'))){
			// hide the form
			frm.style.display = '';
		} else {
			// insert the form into the targeted li
			evt.target.closest('li').appendChild(frm);
			frm.style.display = 'block';
		}
		return false;
	}, false);
}
document.getElementById('referForm').addEventListener('change', function(evt){
	var tgt = evt.target;
	if (tgt.name == 'radReferPolicy'){
		// Harvest form info
		var title = tgt.labels[0].getAttribute('title'), ref = '', btnText = '';
		switch(tgt.value){
			case 'no-referrer':
				btnText = 'NR';
				break;
			case 'origin-only':
				btnText = 'OO';
				ref = title.slice(title.indexOf(':') + 1).trim();
				break;
			case 'origin-path':
				btnText = 'OP';
				ref = title.slice(title.indexOf(':') + 1).trim();
				break;
		}

		// Hide the form
		tgt.form.style.display = '';

		// Update the button
		for (var i=0; i<referPolicyButtons.length; i++){
			referPolicyButtons[i].textContent = btnText;
			referPolicyButtons[i].setAttribute('title', title);
		}
		// Update the links
		var linkNoAccept = document.querySelector('#saveasnoaccept a[href]'), linkAsIE11 = document.querySelector('#saveasie11 a[href]'), pos;
		if (ref.length == 0){
			pos = linkNoAccept.href.indexOf('&viirreferrer=');
			if (pos > -1) linkNoAccept.href = linkNoAccept.href.slice(0, pos);
			pos = linkAsIE11.href.indexOf('&viirreferrer=');
			if (pos > -1) linkAsIE11.href = linkAsIE11.href.slice(0, pos);
		} else {
			pos = linkNoAccept.href.indexOf('&viirreferrer=');
			if (pos > -1) linkNoAccept.href = linkNoAccept.href.slice(0, pos) + '&viirreferrer=' + encodeURIComponent(ref);
			else linkNoAccept.href += '&viirreferrer=' + encodeURIComponent(ref);
			pos = linkAsIE11.href.indexOf('&viirreferrer=');
			if (pos > -1) linkAsIE11.href = linkAsIE11.href.slice(0, pos) + '&viirreferrer=' + encodeURIComponent(ref);
			else linkAsIE11.href += '&viirreferrer=' + encodeURIComponent(ref);
		}
		// If directed to the preview, re-request the image
		if (tgt.closest('ul').id == 'previewtools'){
			updatePreview(ref);
		}
	}
}, false);

function updatePreview(refUrl){		// [v1.8]
	var img = document.getElementById('preview');
	img.onerror = function(event){
		document.querySelector('#oops span').textContent = 'Image did not load, possibly due to lack of credentials or referring host name.';
		document.getElementById('oops').style.display = 'block';
	};
	img.onload = function(event){
		document.getElementById('oops').style.display = '';
		// remove height and width attributes
		var img = event.target;
		img.removeAttribute('height');
		img.removeAttribute('width');
		// check zoom-ability [v1.8]
		if (img.height != img.naturalHeight && details.previewstyle == 'topthumb') img.className = 'shrinkToFit';
		else if(img.height != img.naturalHeight && details.previewstyle == 'topfitw') img.className = 'fitw';
	};
	var url = new URL(img.src);
	var searcharray = url.search.slice(1).split('&');
	if (searcharray.length == 2 && refUrl.length > 0){				// add Referer
		url.search += '&viirreferrer=' + encodeURIComponent(refUrl);
	} else if (searcharray.length == 3 && refUrl.length == 0) {		// remove Referer
		searcharray.pop();
		url.search = '?' + searcharray.join('&');
	} else if (searcharray.length == 3 && refUrl.length > 0) {		// update Referer
		searcharray[2] = 'viirreferrer=' + encodeURIComponent(refUrl);
		url.search = '?' + searcharray.join('&');
	} else {
		console.log('Unexpected url.search and searcharray: ', url.search, searcharray);
	}
	img.src = url.href;
}

/**** Handle Requests from Background script ****/
let moredetails = {};
function handleMessage(request, sender, sendResponse){
	// Update displayed info
	if ('headerdetails' in request){
		var moredetails = request.headerdetails;
		if (moredetails.mimeType){
			document.getElementById('mimeType').textContent = moredetails.mimeType.slice(moredetails.mimeType.indexOf('/')+1).toUpperCase();
			document.getElementById('defaultmime').textContent = '(' + document.getElementById('mimeType').textContent + ')';
		}
		if (moredetails.fileName && moredetails.fileName.length > 0 && document.getElementById('fileName').textContent == ''){
			document.getElementById('fileName').textContent = moredetails.fileName;
			document.getElementById('fname').style.display = '';
		} else if (document.getElementById('fileName').textContent == ''){
			document.getElementById('fname').style.display = 'none';
		}
		if (moredetails.lastModified && moredetails.lastModified.length > 0 && document.getElementById('lastMod').textContent == ''){
			document.getElementById('lastMod').textContent = moredetails.lastModified;
			document.getElementById('modified').style.display = '';
		} else if (document.getElementById('lastMod').textContent == ''){
			document.getElementById('modified').style.display = 'none';
		}
	} else if ('oopsmsg' in request){
		document.querySelector('#oops span').textContent = request.oopsmsg;
		document.getElementById('oops').style.display = 'block';
	}
}
browser.runtime.onMessage.addListener(handleMessage);

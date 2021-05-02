/* 
  View Image Info Reborn - Content - Proximate Script
  Copyright 2021. Jefferson "jscher2000" Scher. License: MPL-2.0.
  Script to capture proximate image data at the point of right-click
  Draws heavily from https://github.com/kubuzetto/behind/blob/master/content.js by Devrim Şahin 
  version 1.9.1 - bug fix, initial scaffolding for background images
*/

var targetProps = {}, lastRightClick = [];

document.addEventListener('contextmenu', gatherProx, true);

function gatherProx(evt){
	// If this is an inline image, capture target properties before it's too late (think YT hover previews)
	if (evt.target.nodeName == 'IMG'){
		targetProps = getProps(evt.target);
	}

	/*
	// TODO: Catalog proximate images, starting from html tag [v2.0]
	lastRightClick = [];
	var customFilter = collisionFilter(evt.clientX, evt.clientY, 4);
	var roots = [document.children[0]];
	let root;
	while (root = roots.shift ()) {
		var nodes = document.createNodeIterator(root, NodeFilter.SHOW_ELEMENT, customFilter);
		let n;
		while (n = nodes.nextNode ()) {
			var nn = n.nodeName, imgUrls = [], nodeprops = {};
			// Handle inline images and special cases
			if (nn == "IMG") {
				imgUrls.push(n.currentSrc);
				nodeprops = getProps(n);
			} else if (nn == "SVG") {
				if (n.ownerDocument.contentType === "image/svg+xml") {
					imgUrls.push(n.ownerDocument.URL);
				} else {
					var s = n.cloneNode (true);
					s.setAttribute ("xmlns", "http://www.w3.org/2000/svg");
					s.setAttribute ("xmlns:xlink", "http://www.w3.org/1999/xlink");
					imgUrls.push("data:image/svg+xml," + encodeURIComponent (s.outerHTML));
				}
				// nodeprops = getProps(n);
				//add (svgToURL (n), true, nn);
			} else if (nn == "CANVAS") {
				imgUrls.push(n.toDataURL());
				// nodeprops = getProps(n);
				//add (n.toDataURL(), true, nn);
			} else if (nn == "VIDEO") {
				if (n.poster){
					imgUrls.push(n.poster);
				}
			}
			// Check for CSS background image
			var elCS = getComputedStyle(n);
			var befCS = getComputedStyle(n, "::before");
			var aftCS = getComputedStyle(n, "::after");
			for (var a of [ 
					elCS.content, befCS.content, aftCS.content, 
					elCS.backgroundImage, befCS.backgroundImage, aftCS.backgroundImage 
				]) {
				if (a) {
					let parts = /url\((['"]?)(.+)\1\)/.exec(a);
					if (parts && parts.length > 2){
						imgUrls.push(parts[2]);
						//add(parts[2], false, nn);
					}
				}
			}
			// If there's an image, add to array
			if (imgUrls.length > 0){
				for (var i=0; i<imgUrls.length; i++){
					var imgUrl = imgUrls[i].trim();
					// fix relative URLs (skip blob and data URLs)
					if (!imgUrl.startsWith("blob:") && !imgUrl.startsWith("data:")) {
						imgUrl = new URL(imgUrl, document.baseURI).href;
					}
					lastRightClick.push({
						id: lastRightClick.length,
						zIndex: (isNaN(parseInt(elCS['z-index']))) ? 0 : parseInt(elCS['z-index']),
						srcUrl: imgUrl,
						tag: nn,
						props: nodeprops
					});
				}
			}
			if (n.shadowRoot) roots.push (n.shadowRoot);
		}
	}
	// Update background
	browser.runtime.sendMessage({
		proximate: lastRightClick
	});
	*/
}

/*
var collisionFilter = function (x, y, r) {
	return { acceptNode: function (e) {
		var bb = e.getBoundingClientRect ();
		if (x >= bb.left - r && x <= bb.right + r && y >= bb.top - r && y <= bb.bottom + r){
			if (getComputedStyle(e).visibility != 'hidden') return NodeFilter.FILTER_ACCEPT;
		}
		return NodeFilter.FILTER_SKIP;
	}};
};
*/

var getProps = function (el){
	var props = {
		pageUrl: location.href,
		pageTitle: document.title,
		referUrl: '',
		currentSrc: el.currentSrc,
		imgSrc: el.src,
		naturalHeight: el.naturalHeight,
		naturalWidth: el.naturalWidth,
		scaledHeight: el.height,
		scaledWidth: el.width,
		mimeType: null,
		decodedSize: null,
		transferSize: null,
		transferTime: null,
		attribJSON: null,
		ahref: null,
		picsrc: null
	};
	if (window.performance){
		var imgp = performance.getEntriesByName(el.currentSrc);
		if (!imgp) imgp = performance.getEntriesByName(el.src);
		if (imgp && imgp.length > 0 && imgp[0].decodedBodySize > 0){
			props.decodedSize = imgp[0].decodedBodySize;
			if (imgp[0].transferSize > 0) props.transferSize = imgp[0].transferSize;
			props.transferTime = imgp[0].duration;
		}
	}
	var arrAtt = [];
	var elAtt = el.attributes;
	for (var i=0; i<elAtt.length; i++){
		arrAtt.push({
			attrname: elAtt[i].name,
			attrvalue: elAtt[i].value
		});
	}
	arrAtt.sort((a, b) => a.attrname.toLowerCase() < b.attrname.toLowerCase() ? -1 : (a.attrname.toLowerCase() > b.attrname.toLowerCase() ? 1 : 0));
	props.attribJSON = JSON.stringify(arrAtt);
	// Check for parent link [v1.8]
	var ahref = '';
	var ael = el.closest('a');
	if (ael && ael.href) ahref = ael.href;
	props.ahref = ahref;
	// Check for parent picture element [v1.8.1]
	var picturesrc = [];
	var pict = el.closest('picture');
	if (pict){
		var psrcs = pict.querySelectorAll('source');
		for (var i=0; i<psrcs.length; i++){
			var psrcitem = {
				srcset: '',
				media: ''
			};
			if(psrcs[i].srcset){
				psrcitem.srcset = psrcs[i].srcset;
			}
			if(psrcs[i].media){
				psrcitem.media = psrcs[i].media;
			}
			picturesrc.push(psrcitem);
		}
	}
	props.picsrc = JSON.stringify(picturesrc);
	return props;
}

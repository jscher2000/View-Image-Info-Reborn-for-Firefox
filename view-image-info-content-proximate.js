/* 
  View Image Info Reborn - Content - Proximate Script
  Copyright 2021. Jefferson "jscher2000" Scher. License: MPL-2.0.
  Script to capture proximate image data at the point of right-click
  Draws heavily from https://github.com/kubuzetto/behind/blob/master/content.js by Devrim Şahin 
  version 1.9.1 - bug fix, initial scaffolding for background images
  version 2.0 - launch background/behind features
  version 2.0.1 - bug fix (temporary workaround for menu not appearing on td>img)
*/

var targetProps = {}, lastRightClick = [];

document.addEventListener('contextmenu', gatherProx, true);

function gatherProx(evt){
	// If this is an inline image, capture target properties before it's too late (think YT hover previews)
	if (evt.target.nodeName == 'IMG'){
		targetProps = getProps(evt.target);
		// TEMPORARY: If the immediate parent is a table cell, quit now [v2.0.1]
		if (evt.target.parentNode.nodeName == 'TD'){
			lastRightClick = [];
			return;
		}
	}

	// Catalog proximate images, starting from html tag [v2.0]
	lastRightClick = [];
	var customFilter = collisionFilter(evt.clientX, evt.clientY, 4);
	var roots = [document.children[0]];
	let root;
	while (root = roots.shift ()) {
		var nodes = document.createNodeIterator(root, NodeFilter.SHOW_ELEMENT, customFilter);
		let n;
		while (n = nodes.nextNode ()) {
			var nn = n.nodeName, imgUrls = [], nodeProps = [];
			// Handle inline images and special cases
			if (nn == "IMG") {
				imgUrls.push(n.currentSrc);
				nodeProps.push(getProps(n, n.currentSrc, false));
			/*  TODO: Future version
				} else if (nn == "VIDEO") {
					if (n.poster){
						imgUrls.push(n.poster);
						// do we need to fix URL first?
						nodeProps.push(getProps(n, n.poster, false));
					}
				} else if (nn == "SVG") {
					if (n.ownerDocument.contentType === "image/svg+xml") {
						imgUrls.push(n.ownerDocument.URL);
					} else {
						var s = n.cloneNode (true);
						s.setAttribute ("xmlns", "http://www.w3.org/2000/svg");
						s.setAttribute ("xmlns:xlink", "http://www.w3.org/1999/xlink");
						imgUrls.push("data:image/svg+xml," + encodeURIComponent (s.outerHTML));
					}
					// WHAT ABOUT nodeProps ?
				} else if (nn == "CANVAS") {
					imgUrls.push(n.toDataURL());
					// WHAT ABOUT nodeProps ?
			*/
			}
			// Check for CSS background image or replaced content
			var elCS = getComputedStyle(n);
			if (elCS.backgroundImage) {
				let parts = /url\((['"]?)(.+)\1\)/.exec(elCS.backgroundImage);
				if (parts && parts.length > 2){
					imgUrls.push(parts[2]);
					nodeProps.push(getProps(n, parts[2], true));
				}
			}
			if (elCS.content) {
				parts = /url\((['"]?)(.+)\1\)/.exec(elCS.content);
				if (parts && parts.length > 2){
					imgUrls.push(parts[2]);
					nodeProps.push(getProps(n, parts[2], false));
				}
			}
			/*  TODO: Future version
				var befCS = getComputedStyle(n, "::before");
				var aftCS = getComputedStyle(n, "::after");
			*/

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
						target: (evt.target == n),
						props: nodeProps[i]
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
}

var collisionFilter = function (x, y, r) {
	return { acceptNode: function (e) {
		var bb = e.getBoundingClientRect ();
		if (x >= bb.left - r && x <= bb.right + r && y >= bb.top - r && y <= bb.bottom + r){
			if (getComputedStyle(e).visibility != 'hidden') return NodeFilter.FILTER_ACCEPT;
		}
		return NodeFilter.FILTER_SKIP;
	}};
};

var getProps = function (el, url, is_bg){
	var elCS = getComputedStyle(el);
	var props = {
		pageUrl: location.href,
		pageTitle: document.title,
		referUrl: '',
		currentSrc: el.currentSrc || '',
		imgSrc: el.src || url,
		naturalHeight: el.naturalHeight || null,
		naturalWidth: el.naturalWidth || null,
		scaledHeight: el.height || parseInt(elCS.height),
		scaledWidth: el.width || parseInt(elCS.width),
		mimeType: null,
		decodedSize: null,
		transferSize: null,
		transferTime: null,
		attribJSON: null,
		ahref: null,
		picsrc: null,
		bgprops: null
	};
	if (window.performance){
		var imgp = performance.getEntriesByName(props.currentSrc);
		if (!imgp) imgp = performance.getEntriesByName(props.imgSrc);
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
	// Check for parent link
	var ahref = '';
	var ael = el.closest('a');
	if (ael && ael.href) ahref = ael.href;
	props.ahref = ahref;
	// Check for parent picture element
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
	// Store relevant (?) background image properties
	if (is_bg){
		props.bgprops = {
			"background-attachment": elCS.backgroundAttachment,
			"background-blend-mode": elCS.backgroundBlendMode,
			"background-clip": elCS.backgroundClip,
			"background-color": elCS.backgroundColor,
			"background-origin": elCS.backgroundOrigin,
			"background-position": elCS.backgroundPosition,
			"background-repeat": elCS.backgroundRepeat,
			"background-size": elCS.backgroundSize
		}
	}
	return props;
}

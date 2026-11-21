"use client";

import { Bookmark } from "lucide-react";
import { useEffect, useRef } from "react";

/** Runs on an ICA product page: reads the product JSON with the user's own session and hands it to foodprice. */
function buildBookmarklet(origin: string): string {
  const src = `(async()=>{const O=${JSON.stringify(origin)};
const m=location.pathname.match(/\\/stores\\/(\\d+)\\/products\\/(?:[^/]+\\/)?(\\d+)/);
if(location.hostname!=="handlaprivatkund.ica.se"||!m){alert("foodprice: open a product page on handlaprivatkund.ica.se first.");return;}
const w=window.open(O+"/import/receive","foodprice-import");
if(!w){alert("foodprice: allow pop-ups for this site and try again.");return;}
let ready=false,msg=null;const send=()=>{if(ready&&msg){w.postMessage(msg,O);window.removeEventListener("message",on);}};
const on=e=>{if(e.origin===O&&e.data==="foodprice:ready"){ready=true;send();}};
window.addEventListener("message",on);
try{const r=await fetch("/stores/"+m[1]+"/api/webproductpagews/v5/products/bop?retailerProductId="+m[2],{credentials:"include",headers:{Accept:"application/json"}});
if(!r.ok)throw new Error("HTTP "+r.status);
msg={type:"foodprice:ica",url:location.origin+location.pathname,payload:await r.json()};}
catch(e){msg={type:"foodprice:error",message:String(e&&e.message||e)};}
send();})();`;
  return "javascript:" + encodeURIComponent(src.replace(/\n/g, ""));
}

export function BookmarkletLink() {
  const ref = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    // React refuses javascript: URLs in JSX, so set it directly.
    ref.current?.setAttribute("href", buildBookmarklet(window.location.origin));
  }, []);
  return (
    <a
      ref={ref}
      onClick={(e) => {
        e.preventDefault();
        alert("Drag this button to your bookmarks bar, then click it while viewing an ICA product.");
      }}
      className="btn-tag h-14 cursor-grab px-6 text-base -rotate-2 shadow-lg active:cursor-grabbing"
      draggable
    >
      <Bookmark className="size-4" /> + foodprice
    </a>
  );
}

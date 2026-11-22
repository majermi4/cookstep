// Read camera capture dates before canvas strips EXIF (including GPS).
export function exifDate(buffer) {
  try {
    const v=new DataView(buffer); if(v.getUint16(0)!==0xffd8)return null;
    let p=2;
    while(p+4<=v.byteLength){
      if(v.getUint8(p)!==0xff)break;
      const marker=v.getUint8(p+1),length=v.getUint16(p+2); if(length<2||p+2+length>v.byteLength)break;
      if(marker===0xe1&&length>=10&&v.getUint32(p+4)===0x45786966&&v.getUint16(p+8)===0){
        const base=p+10,end=p+2+length, little=v.getUint16(base)===0x4949;
        if(!little&&v.getUint16(base)!==0x4d4d)return null;
        const u16=o=>{if(o<base||o+2>end)throw Error();return v.getUint16(o,little);};
        const u32=o=>{if(o<base||o+4>end)throw Error();return v.getUint32(o,little);};
        if(u16(base+2)!==42)return null;
        const find=(offset,tag)=>{const at=base+offset,count=u16(at);if(count>512)throw Error();for(let i=0;i<count;i++){const e=at+2+i*12;if(u16(e)===tag)return e;}return null;};
        const root=u32(base+4),exif=find(root,0x8769),date=(exif&&find(u32(exif+8),0x9003))||find(root,0x0132);
        if(!date||u16(date+2)!==2||u32(date+4)<19)return null;
        const at=base+u32(date+8);if(at+19>end)return null;
        const value=String.fromCharCode(...new Uint8Array(buffer,at,19));
        const m=/^(\d{4}):(\d{2}):(\d{2}) \d{2}:\d{2}:\d{2}$/.exec(value);
        if(!m)return null;const day=`${m[1]}-${m[2]}-${m[3]}`;
        return validDate(day)?day:null;
      }
      p+=2+length;
    }
  } catch {} return null;
}
export function validDate(value){if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const d=new Date(value+'T00:00:00Z');return !Number.isNaN(d.valueOf())&&d.toISOString().slice(0,10)===value;}
export function localToday(now=new Date()){return [now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');}
export function suggestedDate(dates,now=new Date()){return dates.filter(validDate).sort()[0]||localToday(now);}
export async function preparePhoto(file){
  const date=exifDate(await file.arrayBuffer());
  const url=URL.createObjectURL(file);
  try {
    const img=new Image();img.src=url;await img.decode();
    if(!img.naturalWidth||!img.naturalHeight)throw Error('Image has no dimensions.');
    const scale=Math.min(1,1920/Math.max(img.naturalWidth,img.naturalHeight));
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
    const ctx=canvas.getContext('2d');if(!ctx)throw Error('Image processing is unavailable.');
    ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',0.86));if(!blob)throw Error('Could not create a photo copy.');
    return {date,blob};
  } finally {URL.revokeObjectURL(url);}
}

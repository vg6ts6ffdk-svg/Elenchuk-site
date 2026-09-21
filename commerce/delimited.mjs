const MAX_BYTES=2*1024*1024;
export function parseDelimited(input){
  if(typeof input!=='string') throw new TypeError('CSV должен быть текстом');
  if(Buffer.byteLength(input,'utf8')>MAX_BYTES) throw new TypeError('CSV превышает 2 МБ');
  const source=input.replace(/^\uFEFF/,'');
  if(!source.trim()) throw new TypeError('CSV пуст');
  const first=source.split(/\r?\n/,1)[0];
  const candidates=[',',';','\t'];
  const counts=candidates.map(d=>[d,countOutsideQuotes(first,d)]).sort((a,b)=>b[1]-a[1]);
  const delimiter=counts[0][1]>0?counts[0][0]:',';
  const matrix=[];let row=[],field='',quoted=false;
  for(let i=0;i<source.length;i++){
    const ch=source[i];
    if(ch==='"'){
      if(quoted&&source[i+1]==='"'){field+='"';i++;} else quoted=!quoted;
    } else if(ch===delimiter&&!quoted){row.push(field);field='';}
    else if((ch==='\n'||ch==='\r')&&!quoted){
      if(ch==='\r'&&source[i+1]==='\n')i++;
      row.push(field);field='';if(row.some(v=>v.trim()!==''))matrix.push(row);row=[];
    } else field+=ch;
  }
  if(quoted) throw new TypeError('Незакрытая кавычка в CSV');
  row.push(field);if(row.some(v=>v.trim()!==''))matrix.push(row);
  if(matrix.length<2) throw new TypeError('CSV должен содержать заголовок и хотя бы одну строку');
  const headers=matrix.shift().map(h=>h.trim());
  if(new Set(headers).size!==headers.length||headers.some(h=>!h)) throw new TypeError('Некорректные или повторяющиеся заголовки CSV');
  return matrix.map(values=>Object.fromEntries(headers.map((h,i)=>[h,(values[i]??'').trim()])));
}
function countOutsideQuotes(line,delimiter){let quoted=false,count=0;for(let i=0;i<line.length;i++){if(line[i]==='"'){if(quoted&&line[i+1]==='"')i++;else quoted=!quoted;}else if(!quoted&&line[i]===delimiter)count++;}return count;}

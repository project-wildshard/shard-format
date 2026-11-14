import type {Shardfile} from './shardSchema.ts';
import {preflightShardfile} from './preflight.ts';

/** What `shardfileWireBytes` reads of a product. */
type Wire=Readonly<{files:readonly Readonly<{compressed:number}>[];requires:Readonly<{commons:readonly string[];commonsWire:Readonly<Record<string,number>>}>}>;
/** The wire a product claim holds: every file's and pinned common's compressed bytes. No residency figure is below it. */
function shardfileWireBytes(source:Wire):number{
  return source.files.reduce((sum,file)=>sum+file.compressed,0)
    +source.requires.commons.reduce((sum,hash)=>sum+(source.requires.commonsWire[hash]??0),0);
}
/** Exact existing source/wire claim, computed once by the publisher for first-party clients. */
function publishedSourceResidency(source:Shardfile):number{
  const accounting={heapBytes:0};preflightShardfile(source,accounting);
  return shardfileWireBytes(source)+accounting.heapBytes*2+(source.files.length+source.requires.commons.length)*128+1024;
}
export {shardfileWireBytes,publishedSourceResidency};

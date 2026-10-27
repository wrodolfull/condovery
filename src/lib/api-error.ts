/** Shared typed API errors. Generic failures stay hidden from clients. */
export class ApiError extends Error {
  constructor(public status:number,message:string){super(message);this.name='ApiError';}
}
export const bad=(message:string,status=400):never=>{throw new ApiError(status,message);};

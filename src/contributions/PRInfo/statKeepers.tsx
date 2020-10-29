import * as React from "react";




export interface IPRDuration
{
    days:number,
    hours:number,
    minutes:number,
    seconds:number,
    milliseconds:number
}

export interface INameCount
{
    name:string,
    value:number
}

export interface IReviewWithVote
{
    name:string,
    value:number,
    voteApprove:number,
    voteReject:number,
    notVote:number,
    voteWait:number
}

export function CompareINameCountByValue(n1:INameCount, n2:INameCount)
{
    if (n1.value > n2.value) { return -1; }  
    if (n1.value < n2.value) {return 1; }  
    return 0;  

}

export function CompareReviewWithVoteByValue(r1: IReviewWithVote, r2: IReviewWithVote) {  
    if (r1.value > r2.value) { return -1; }  
    if (r1.value < r2.value) {return 1; }  
    return 0;  
} 


export function getMillisecondsToTime(duration:number):IPRDuration {
    //let duration:number = endTime.valueOf() - startTime.valueOf();
    
        let remain = duration
      
        let days = Math.floor(remain / (1000 * 60 * 60 * 24))
        remain = remain % (1000 * 60 * 60 * 24)
      
        let hours = Math.floor(remain / (1000 * 60 * 60))
        remain = remain % (1000 * 60 * 60)
      
        let minutes = Math.floor(remain / (1000 * 60))
        remain = remain % (1000 * 60)
      
        let seconds = Math.floor(remain / (1000))
        remain = remain % (1000)
      
        let milliseconds = remain
      
        return {
          days,
          hours,
          minutes,
          seconds,
          milliseconds
        }; 

  }
  

  export function getTotalCountForVoteReject(reviews:IReviewWithVote[]):number
  {
      let total:number =0;
      reviews.forEach(r=>{
          total += r.voteReject;
      });
      return total;
  }

  export function getTotalCountForVoteWait(reviews:IReviewWithVote[]):number
  {
      let total:number =0;
      reviews.forEach(r=>{
          total += r.voteWait;
      });
      return total;
  }
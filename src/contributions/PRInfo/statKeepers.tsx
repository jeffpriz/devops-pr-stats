import * as React from "react";
import { GitPullRequest, PullRequestStatus } from "azure-devops-extension-api/Git";



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

export interface IDurationSlice
{
    startDate:Date,
    PRCount:number,
    minutes:number,
    runningTotalMinutes:number,
    runningTotalCount:number
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

export function ComparePRClosedDate(pr1: GitPullRequest, pr2: GitPullRequest)
{
    if(pr1.closedDate > pr2.closedDate) {return -1;}
    if(pr1.closedDate < pr2.closedDate) {return 1;}
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

  export function getDateofEarliestPR(pullRequests:GitPullRequest[]):Date
  {
        let returnDate:Date = new Date();

        pullRequests.forEach(thisPR => {
            if(thisPR.closedDate < returnDate)
            {

                returnDate = thisPR.closedDate;
            }
        });
        return returnDate;
    

  }

  export function getLastMonday():Date
  { 
    var prevMonday = new Date();
    prevMonday.setDate(prevMonday.getDate() - (prevMonday.getDay() + 6) % 7);

    return prevMonday;

  }
  


  export function getMondayBeforeEarliestPR(pullRequests:GitPullRequest[]):Date
  {
    
    let earliestPR:Date = getDateofEarliestPR(pullRequests);
    let thisMonday = getLastMonday();       
    do {
        
        thisMonday = new Date(thisMonday.setDate((thisMonday.getDate() - 7)));
    
    } while(thisMonday >  earliestPR)
    
    return thisMonday;
  }


  export function getPRDurationSlices(pullRequests:GitPullRequest[]):IDurationSlice[]
  {

    let slices:IDurationSlice[] = [];
    let ndx:number = pullRequests.length-1;
    let sliceDate:Date = getMondayBeforeEarliestPR(pullRequests);
    let mathDate:Date = new Date(sliceDate);
    let runningTotalCount:number = 0;
    let runningTotalMinutes:number = 0;
    //console.log("monday before earliest PR: " + sliceDate.toLocaleString());
    //console.log("PR NDX " + ndx.toString());
    if(ndx > 0)
    {
        let newSlice:IDurationSlice = {startDate:sliceDate,PRCount:0, minutes:0, runningTotalCount:0, runningTotalMinutes:0};
        let nextSliceDate:Date =new Date(mathDate.setDate((mathDate.getDate() + 14)));
        //console.log("newsliceDate : " + sliceDate.toLocaleString() + "   next sliceDate : " + nextSliceDate.toLocaleString());
        do
        {
            let addedSlice:boolean = false;
            let isthisPRinSlice:boolean =false;
            let thisPR:GitPullRequest = pullRequests[ndx];
            //console.log(thisPR.closedDate.toLocaleString());
            if(thisPR.closedDate > nextSliceDate) // we have a PR that goes to a future slice, we're done with the current slice.
            {
                //console.log("new slice push");
                slices.push({startDate: newSlice.startDate, minutes:newSlice.minutes, PRCount:newSlice.PRCount, runningTotalCount:runningTotalCount, runningTotalMinutes:runningTotalMinutes});                
                sliceDate = new Date(nextSliceDate);

                newSlice = {startDate:sliceDate, PRCount:0, minutes:0, runningTotalCount:runningTotalCount, runningTotalMinutes:runningTotalMinutes};
                mathDate = new Date(sliceDate);
                nextSliceDate = new Date(mathDate.setDate((mathDate.getDate() + 14)));               
                addedSlice = true;
                //console.log("newsliceDate : " + sliceDate.toLocaleString() + "   next sliceDate : " + nextSliceDate.toLocaleString());
            }
            if(thisPR.closedDate > sliceDate && thisPR.closedDate < nextSliceDate)
            {
               // console.log("adding this PR to the slice --" + thisPR.pullRequestId.toString());
                newSlice.PRCount +=1;
                let thisPRDuration = Math.floor((thisPR.closedDate.valueOf() - thisPR.creationDate.valueOf()) /60000);
                newSlice.minutes += thisPRDuration;
                runningTotalMinutes += thisPRDuration;
                runningTotalCount +=1;
                isthisPRinSlice = true;
            }
            
            if(addedSlice && !isthisPRinSlice)
            {

            }
            else
            {
                ndx --;
            }
            
            

        }
        while(ndx>=0);
        slices.push({startDate: newSlice.startDate, minutes:newSlice.minutes, PRCount:newSlice.PRCount, runningTotalCount:runningTotalCount, runningTotalMinutes:runningTotalMinutes});                
    }   
    return slices;

  }
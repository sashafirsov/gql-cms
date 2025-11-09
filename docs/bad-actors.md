# Add rate-limiting to prevent bad-actors

There are two DoS patterns addressed:
* for authorized user session
* anonymous

# Authorized user
## out of scope
* ability to execute non-authorized actions, addressed by [ACL](./ACL.md) on DB level.
* licence based rate limit per domain/short url/user
* configuration of rate limit for system/user/etc.
* multiple sessions per user. 
* separate user creation rate limit. Can be combined by rate limit based on IP or user or sesssion.
* rate limit for DMZ IPs. Often multiple users and even countries use the same IP. 
The rate limit should use other mechanism than IP detection. Like session cookies.
* multiple nodes handling. The shared IP pool over in-memory DB like Redis can serve as common IP rate dataset.
* The reCapcha page content is suggested to allow the legitimate user the flow completion.

## limit the number of current documents
The number of documents, and as result a short urls, for particular user is limited to `MAX_DOCUMENTS_PER_USER=100` constant


## Limit the rate of creation 
With a compromised account or session, with generated users, the bad actor could try to abuse the system 
by issuing multiple requests on the user's behalf.

### user creation from same IP 
Handled by generic rate per IP limit algorith. 

### user authentication from same IP 
Handled by generic rate per IP limit algorith. 

# IP limit algorith
Keep, per IP, a `{second_bucket_start, count}` on each request, 

if floor(now) equals second_bucket_start then ++count, else reset to (floor(now), 1). Allow the request if count ≤ 100, 
otherwise reject—this enforces a coarse “≤100 per labeled second” cap with O(1) state.

_Calls per minute bounds:_

Per labeled minute (e.g., 12:34:00–12:34:59): max = 6,000, min = 0.

Any 60-second sliding window: max ≈ 6,100, min ≈ 5,900 (due to second-boundary bursts/holes).

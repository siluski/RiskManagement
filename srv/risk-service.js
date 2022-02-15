//Imports 
const cds = require("@sap/cds");

/** The service implementation with
 * all service handlers
 */
module.exports = cds.service.impl(async function () {
    //Define constants for the Risk and BP entitites from the risk-service.cds file
    const { Risks, BusinessPartners} = this.entities;
    /**
     * set criticality after a READ operation on /risks
     */

     this.after("READ", Risks, (data) => {
         const risks = Array.isArray(data) ? data : [data];
         risks.forEach((risk) => {
             if(risk.impact >= 100000){
                 risk.criticality = 1;
             }else{
                 risk.criticality = 2;
             }
         });
     });
     //Connect to remote service
     const BPsrv = await cds.connect.to("API_BUSINESS_PARTNER");
     
     /**
      * Event handler for read events on the BusinessPartners entity
      * Each request to the API Business Hub requires the apikey in the header
      */
     this.on("READ", BusinessPartners, async (req) => {
        /**API sandbox returns a lot of business partners with empty names
         * We don't want them in our app
         */
        req.query.where("LastName <> '' and FirstName <> '' ");

        return await BPsrv.transaction(req).send({
            query: req.query,
            headers: {
                apikey: process.env.apikey
            }
        });
        
     });

    this.on("READ", Risks, async (req, next) => {
        try {
            const res = await next();
            await Promise.all(
                res.map(async (risk) => {
                    const bp = await BPsrv.transaction(req).send({
                        query : SELECT.one(this.entities.BusinessPartners).where({BusinessPartner: risk.bp_BusinessPartner})
                        .columns(["BusinessPartner", "LastName", "FirstName"]),
                        headers: {
                            apikey : process.env.apikey
                        }
                    });
                    risk.bp = bp;
                })
            );
        }catch (error) {}
     });
});
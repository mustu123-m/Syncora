module.exports.requireLogin=(req,resp,next)=>{
    if(!req.session.userId){
        resp.redirect("/login");
    }
  else  next();
}

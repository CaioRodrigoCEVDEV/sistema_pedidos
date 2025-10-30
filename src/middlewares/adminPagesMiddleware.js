const jwt = require('jsonwebtoken');

function requireAdmin(req, res, next) {
    const token = req.cookies.token;

    if (!token) {
        return res.status(401).redirect('/login');
    }

    try {
        const decoded = jwt.verify(token, 'chave-secreta');
        // gera de novo um novo token com 10 minutos
        const novoToken = jwt.sign({
            usuemail: decoded.usuemail,
            usucod: decoded.usucod,
            usunome: decoded.usunome,
            usuadm: decoded.usuadm,
            usupv: decoded.usupv,
            usuest: decoded.usuest
        }, 'chave-secreta', { expiresIn: '60m' });

        // gauda o novo token com mais 10m em cookies
        res.cookie('token', novoToken, {
            httpOnly: true,
            sameSite: 'Strict',
            secure: process.env.HTTPS,
        });
        // Remove os outros cookies inseguros, se ainda existirem
        res.clearCookie('usucod');
        res.clearCookie('usunome');
        res.clearCookie('usuemail');
        res.clearCookie('usuadm');
        res.clearCookie('usupv');
        res.clearCookie('usuest');

        req.token = decoded; // Armazena dados decodificados para uso futuro

        if (decoded && decoded.usuadm === 'S') {
            req.user = decoded; // Optional: store decoded user info
            next();
        } else {
            //return res.status(403).redirect('/painel');
            return res.status(403).redirect('/painel?erroMSG=acesso-negado');

        }
    } catch (err) {
        return res.status(500).redirect('/login');
    }
}

module.exports = requireAdmin;
